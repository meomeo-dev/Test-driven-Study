const HAN_RE = /[\u4e00-\u9fff]/;
const EN_WORD_RE = /[A-Za-z]{2,}/;
const LATIN_RE = /[A-Za-z]/;
const EDGE_SPACE_RE = /^\s|\s$/;
const QUOTE_WRAP_RE =
  /^(?:"[^"]*"|'[^']*'|`[^`]*`|“[^”]*”|‘[^’]*’|「[^」]*」)$/;
const NON_SPEAKABLE_RE = /->|→|√|__+|\/[A-Za-zɪʊəɜɑɔæʌθðŋʃʒː]+\//;
const BARE_LETTER_RE = /^[A-Za-z]$/;
const ENGLISH_SINGLE_WORDS = new Set(["I", "a", "A"]);
const EN_SENTENCE_RE = /[A-Za-z]+(?:\s+[A-Za-z'’]+){3,}/;
const NON_ENGLISH_OPT_RE = /[\u4e00-\u9fff]|->|→|√|__+|`|\/[A-Za-zɪʊəɜɑɔæʌθðŋʃʒː]+\//;
const TRIVIAL_TF_RE = /^(?:true|false|t|f)$/i;

const hasTts = (tts) => tts !== undefined && tts !== false && tts !== null;
const ttsObj = (tts) => (tts && typeof tts === "object" ? tts : null);

function addIssue(ctx, path, rule, message, severity = "error") {
  const itemId = ctx.item.id ?? "(unknown)";
  ctx.issues.push({ severity, file: ctx.file, itemId, path, rule, message });
}

function countSentences(text) {
  const matches = text.match(/[.!?](?:\s|$)|[。！？]/g);
  return matches ? matches.length : 0;
}

function checkCoarseSegment(ctx, path, raw, allowCoarse) {
  if (allowCoarse || !raw) return;
  if (raw.includes("\n") || countSentences(raw) >= 3 || raw.length > 160) {
    addIssue(ctx, path, "COARSE_TTS_SEGMENT",
      "单个 TTS 切片过长或含换行符，请按标题/句界拆分（建议每段 1–2 句）", "warning");
  }
}

function checkNonSpeakable(ctx, path, raw, hasOverride) {
  if (hasOverride) return;
  const hanWithDigit = HAN_RE.test(raw) && /\d/.test(raw);
  const bareLetter = BARE_LETTER_RE.test(raw) && !ENGLISH_SINGLE_WORDS.has(raw);
  if (NON_SPEAKABLE_RE.test(raw) || bareLetter || hanWithDigit) {
    addIssue(ctx, path, "NON_SPEAKABLE_IN_TTS",
      "TTS 片段含不可直读字符（符号/下划线/IPA/单字母或中文内数字），请改用 tts.text 或 pinyin");
  }
}

function checkTextContent(ctx, path, text, tts, ttsText, opts = {}) {
  const cfg = ttsObj(tts);
  const override = ttsText || cfg?.text;
  if (tts === true) {
    addIssue(ctx, path, "TTS_BOOLEAN_SHORTHAND",
      "禁止使用 tts: true 简写，请改为显式对象（如 {\"voice\": \"stella\"}）");
  }
  const raw = text ?? "";
  const spoken = override || raw;
  if (EDGE_SPACE_RE.test(raw) || (override && EDGE_SPACE_RE.test(override))) {
    addIssue(ctx, path, "SEGMENT_WHITESPACE_BOUNDARY",
      "TTS 文本首尾包含空白字符，应将空格移到相邻纯 text 切片");
  }
  if (!override && QUOTE_WRAP_RE.test(raw)) {
    addIssue(ctx, path, "SEGMENT_QUOTE_BOUNDARY",
      "TTS 文本外围包含成对引号或反引号，请将其移到外围纯 text 切片或去掉");
  }
  if (LATIN_RE.test(spoken) && !HAN_RE.test(spoken) && !cfg?.voice && !opts.inheritedVoice) {
    addIssue(ctx, path, "ENGLISH_TTS_MISSING_VOICE",
      "英文 TTS 缺少显式 voice（应指定 \"stella\" 或 \"tide\"）");
  }
  if (!override && HAN_RE.test(raw) && EN_WORD_RE.test(raw)) {
    addIssue(ctx, path, "MIXED_ZH_EN_TTS",
      "同一 TTS 片段混杂中文与英文且无 tts.text 改写，建议按语种拆分或留纯文本");
  }
  checkNonSpeakable(ctx, path, raw, Boolean(override));
  checkCoarseSegment(ctx, path, raw, opts.allowCoarse);
}

function hasBlankSegment(stem) {
  return Array.isArray(stem) && stem.some((seg) => seg.type === "blank");
}

function checkUnvoicedStem(ctx, field, stem, opts) {
  if (opts.forbidTts || opts.isSubQuestion === false) return;
  const raw = typeof stem === "string" ? stem
    : Array.isArray(stem) ? stem.map((s) => s.text || "").join("") : "";
  const cleaned = raw
    .replace(/（[^）]*）|\([^)]*\)|`[^`]*`/g, " ")
    .replace(/\s+/g, " ");
  if (NON_SPEAKABLE_RE.test(cleaned)) return;
  if (opts.isSubQuestion && EN_WORD_RE.test(raw) && !HAN_RE.test(raw)) {
    addIssue(ctx, field, "UNVOICED_ENGLISH_SUBQUESTION",
      "纯英文小题题干未配置 TTS，建议拆分或声明语音", "warning");
    return;
  }
  if (!opts.isSubQuestion && EN_SENTENCE_RE.test(cleaned)) {
    addIssue(ctx, field, "UNVOICED_ENGLISH_SENTENCE",
      "题干包含完整英文句子却未配置 TTS，建议拆分为 ContentSegment 并配语音", "warning");
  }
}

function checkSegments(ctx, field, segments, opts = {}) {
  if (typeof segments === "string") {
    checkUnvoicedStem(ctx, field, segments, opts);
    return;
  }
  if (!Array.isArray(segments)) return;
  let hasBlank = false;
  let hasAnyTts = false;
  segments.forEach((seg, idx) => {
    const path = `${field}[${idx}]`;
    if (seg.type === "blank") { hasBlank = true; return; }
    const usesPinyin = Array.isArray(seg.pinyin) && seg.pinyin.length > 0;
    const usesTts = hasTts(seg.tts) || Boolean(seg.tts_text);
    if (seg.type === "speech" && !usesPinyin && !usesTts && !opts.sequenceMode) {
      addIssue(ctx, path, "SPEECH_TYPE_WITHOUT_AUDIO",
        "type 为 speech 但未声明 tts、tts_text 或 pinyin，前端将静默渲染为纯文本");
    }
    if (usesPinyin || !usesTts) return;
    hasAnyTts = true;
    checkTextContent(ctx, path, seg.text, seg.tts, seg.tts_text, opts);
  });
  if (opts.checkBlankCooccur && hasBlank && hasAnyTts) {
    addIssue(ctx, field, "BLANK_TTS_COOCCURRENCE",
      "同一题干不能同时包含 blank 与 TTS 切片");
  }
  if (opts.forbidTts && hasAnyTts) {
    addIssue(ctx, field, opts.forbidRule, opts.forbidMessage);
  }
  if (!hasAnyTts && !hasBlank) checkUnvoicedStem(ctx, field, segments, opts);
}

function isPureEnglishOption(opt) {
  if (!opt.text || opt.pinyin?.length) return false;
  if (TRIVIAL_TF_RE.test(opt.text.trim())) return false;
  return EN_WORD_RE.test(opt.text) && !NON_ENGLISH_OPT_RE.test(opt.text);
}

function checkOptions(ctx, field, options, opts = {}) {
  if (!Array.isArray(options) || options.length === 0) return;
  const ttsFlags = options.map((opt) => hasTts(opt.tts));
  if (ttsFlags.some(Boolean) && !ttsFlags.every(Boolean)) {
    addIssue(ctx, field, "UNIFORM_OPTION_AUDIO",
      "同组选项的 tts 必须全有或全无（uniformOptionAudio）");
  }
  options.forEach((opt, idx) => {
    if (opt.pinyin?.length || !hasTts(opt.tts)) return;
    checkTextContent(ctx, `${field}[${idx}]`, opt.text, opt.tts, undefined,
      { allowCoarse: true });
  });
  if (!opts.skipUnvoicedCheck && ttsFlags.every((f) => !f) &&
      options.every(isPureEnglishOption)) {
    addIssue(ctx, field, "UNVOICED_ENGLISH_OPTIONS",
      "纯英文选项组未配置 TTS（对比已配语音单元存在不一致）", "warning");
  }
}

function checkAnalysis(ctx, field, analysis) {
  if (typeof analysis === "string") {
    if ((analysis.match(/[A-Za-z]{2,}/g) ?? []).length >= 2) {
      addIssue(ctx, field, "PARTIAL_ANALYSIS_TTS",
        "v2 解析包含英文短语/例句但未配语音切片", "warning");
    }
    return;
  }
  if (!Array.isArray(analysis)) return;
  checkSegments(ctx, field, analysis, { isSubQuestion: false });
  const hasAnyTts = analysis.some((s) => hasTts(s.tts) || Boolean(s.tts_text));
  if (!hasAnyTts) return;
  analysis.forEach((seg, idx) => {
    if (!hasTts(seg.tts) && !seg.tts_text && !seg.pinyin?.length &&
        EN_WORD_RE.test(seg.text || "")) {
      addIssue(ctx, `${field}[${idx}]`, "PARTIAL_ANALYSIS_TTS",
        "解析已启用 TTS，但同段内英文内容仍留在无语音的纯文本切片中", "warning");
    }
  });
}

function inheritedLineVoice(item, speaker) {
  const audio = item.audio;
  if (!audio || typeof audio !== "object") return false;
  return String(speaker).toLowerCase() === "m"
    ? Boolean(audio.voice_male) : Boolean(audio.voice_female);
}

function checkTranscript(ctx, item) {
  if (!Array.isArray(item.transcript)) return;
  const recording = item.audio && typeof item.audio === "object" &&
    item.audio.mode === "recording";
  item.transcript.forEach((line, idx) => {
    if (!hasTts(line.tts)) {
      if (!recording && line.tts === false) {
        addIssue(ctx, `transcript[${idx}]`, "TRANSCRIPT_TTS_DISABLED",
          "听力逐字稿行禁用 tts 将导致无法合成播放");
      }
      return;
    }
    checkTextContent(ctx, `transcript[${idx}]`, line.text, line.tts, undefined,
      { inheritedVoice: inheritedLineVoice(item, line.speaker), allowCoarse: true });
  });
}

function checkWriting(ctx, item) {
  if (item.type !== "writing" || !item.sample_response) return;
  if (!item.sample_response_tts) {
    addIssue(ctx, "sample_response_tts", "WRITING_MISSING_SAMPLE_TTS",
      "writing 题型提供了范文但缺少 sample_response_tts");
    return;
  }
  if (!item.sample_response_tts.voice) {
    addIssue(ctx, "sample_response_tts", "ENGLISH_TTS_MISSING_VOICE",
      "sample_response_tts 缺少显式 voice");
  }
}

function checkSubItems(ctx, item) {
  if (Array.isArray(item.blanks)) {
    item.blanks.forEach((blank, idx) => {
      checkOptions(ctx, `blanks[${idx}].options`, blank.options,
        { skipUnvoicedCheck: true });
      checkSegments(ctx, `blanks[${idx}].explanation`, blank.explanation,
        { isSubQuestion: false });
    });
  }
  if (Array.isArray(item.sub_questions)) {
    item.sub_questions.forEach((sub, idx) => {
      const p = `sub_questions[${idx}]`;
      checkSegments(ctx, `${p}.stem`, sub.stem,
        { checkBlankCooccur: true, isSubQuestion: true });
      checkOptions(ctx, `${p}.options`, sub.options);
      checkAnalysis(ctx, `${p}.analysis`, sub.analysis);
    });
  }
}

export function auditItems(items, file) {
  const issues = [];
  for (const item of items) {
    const ctx = { item, file, issues };
    const isListening = item.type === "listening" ||
      Boolean(item.transcript) || Boolean(item.audio);
    checkSegments(ctx, "stem", item.stem, {
      checkBlankCooccur: true,
      forbidTts: isListening,
      forbidRule: "LISTENING_STEM_TTS_LEAK",
      forbidMessage: "听力题干禁止内嵌 TTS（避免逐字稿剧透）",
    });
    checkSegments(ctx, "passage", item.passage, {
      forbidTts: item.type === "cloze",
      forbidRule: "BLANK_TTS_COOCCURRENCE",
      forbidMessage: "cloze 短文禁止挂 TTS（避免误读填空占位符）",
      isSubQuestion: false,
    });
    checkOptions(ctx, "options", item.options,
      { skipUnvoicedCheck: hasBlankSegment(item.stem) });
    checkTranscript(ctx, item);
    checkAnalysis(ctx, "analysis", item.analysis);
    checkSegments(ctx, "explanation_audio", item.explanation_audio,
      { sequenceMode: true, allowCoarse: true, isSubQuestion: false });
    checkWriting(ctx, item);
    checkSubItems(ctx, item);
  }
  return issues;
}
