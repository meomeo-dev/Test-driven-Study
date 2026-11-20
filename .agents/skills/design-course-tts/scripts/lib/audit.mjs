const HAN_RE = /[\u4e00-\u9fff]/;
const EN_WORD_RE = /[A-Za-z]{2,}/;
const LATIN_RE = /[A-Za-z]/;
const EDGE_SPACE_RE = /^\s|\s$/;
const QUOTE_WRAP_RE =
  /^(?:"[^"]*"|'[^']*'|`[^`]*`|“[^”]*”|‘[^’]*’|「[^」]*」)$/;
const NON_SPEAKABLE_RE =
  /->|→|√|__+|\/[A-Za-zɪʊəɜɑɔæʌθðŋʃʒː]+\/|[÷×±≤≥≠≈=]/;
const BARE_LETTER_RE = /^[A-Za-z]$/;
const ENGLISH_SINGLE_WORDS = new Set(["I", "a", "A"]);
const WORD_TOKEN = "[A-Za-z]+(?:[-'’][A-Za-z]+)*['’]?";
const EN_SENTENCE_RE = new RegExp(`${WORD_TOKEN}(?:\\s+${WORD_TOKEN}){3,}`);
const NON_ENGLISH_OPT_RE =
  /[\u4e00-\u9fff]|->|→|√|__+|`|\/[A-Za-zɪʊəɜɑɔæʌθðŋʃʒː]+\/|[÷×±≤≥≠≈=]/;
const TRIVIAL_TF_RE = /^(?:true|false|t|f)$/i;
const ALL_CAPS_WORD_RE = /\b[A-Z]{4,}\b/;
const VALID_VOICES = new Set(["stella", "tide"]);
const VOCAB_PLACEHOLDER_RE = /…|\.{3,}|\{\{\d+\}\}|\S\s*\/\s*\S|[()（）]/;
const CODE_LINE_RE =
  /(?:[+\-*/]?=|<=|>=|!=|==|\):|\(\):|;|[{}\[\]]|^\s*(?:from\s+\S+\s+import|import\s+\S+|for\s+\w+\s+in\s+|def\s+\w+|class\s+\w+|with\s+\S+)|\b\w+\.\w+\()/;

const hasTts = (tts) => tts !== undefined && tts !== false && tts !== null;
const ttsObj = (tts) => (tts && typeof tts === "object" && !Array.isArray(tts) ? tts : null);

function addIssue(ctx, path, rule, message, severity = "error") {
  const itemId = ctx.item.id ?? "(unknown)";
  ctx.issues.push({ severity, file: ctx.file, itemId, path, rule, message });
}

function countSentences(text) {
  const matches = text.match(/[.!?](?:\s|$)|[。！？]/g);
  return matches ? matches.length : 0;
}

function stripBackticks(text) {
  return (text || "").replace(/`[^`]*`/g, " ");
}

function cleanUnvoicedText(raw) {
  const nonCode = String(raw || "")
    .split(/\r?\n/)
    .filter((line) => !CODE_LINE_RE.test(line))
    .join(" ");
  return nonCode
    .replace(/（[^）]*）|\([^)]*\)|`[^`]*`/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function checkCoarseSegment(ctx, path, text, allowCoarse) {
  if (allowCoarse || !text) return;
  if (text.includes("\n") || countSentences(text) >= 3 || text.length > 160) {
    addIssue(ctx, path, "COARSE_TTS_SEGMENT",
      "单个 TTS 切片过长或含换行符，请按标题/句界拆分（建议每段 1–2 句）", "warning");
  }
}

function checkNonSpeakable(ctx, path, spoken, opts = {}) {
  const hanWithDigit = HAN_RE.test(spoken) && /\d/.test(spoken);
  const bareLetter = BARE_LETTER_RE.test(spoken) && !ENGLISH_SINGLE_WORDS.has(spoken);
  if (NON_SPEAKABLE_RE.test(spoken) || bareLetter || hanWithDigit) {
    addIssue(ctx, path, "NON_SPEAKABLE_IN_TTS",
      "TTS 片段含不可直读字符（符号/下划线/IPA/单字母或中文内数字），请改用 tts.text 或 pinyin");
    return;
  }
  if (opts.forbidPlaceholders && VOCAB_PLACEHOLDER_RE.test(spoken)) {
    addIssue(ctx, path, "NON_SPEAKABLE_IN_TTS",
      "词汇朗读文本含占位符/省略号/斜杠备选或括号注释，请补充 *_tts.text 改写为可直读文本");
  }
}

function checkTextContent(ctx, path, text, tts, ttsText, opts = {}) {
  const cfg = ttsObj(tts);
  const hasCfgText = cfg !== null && cfg.text !== undefined;
  const override = ttsText !== undefined ? ttsText : (hasCfgText ? cfg.text : undefined);
  if (tts === true) {
    addIssue(ctx, path, "TTS_BOOLEAN_SHORTHAND",
      "禁止使用 tts: true 简写，请改为显式对象（如 {\"voice\": \"stella\"}）");
  } else if (typeof tts === "boolean") {
    addIssue(ctx, path, "TTS_BOOLEAN_SHORTHAND",
      "禁止使用 tts 布尔简写，请改为显式对象（如 {\"voice\": \"stella\"}）");
  } else if (tts !== undefined && tts !== null && !cfg) {
    addIssue(ctx, path, "INVALID_TTS_CONFIG",
      "TTS 配置必须是对象（如 {\"voice\": \"stella\"}）");
  }
  if (hasCfgText && (typeof cfg.text !== "string" || cfg.text.trim() === "")) {
    addIssue(ctx, path, "EMPTY_TTS_TEXT",
      "tts.text 不能为空或纯空白字符串");
  }
  if (cfg?.voice !== undefined && !VALID_VOICES.has(cfg.voice)) {
    addIssue(ctx, path, "INVALID_TTS_VOICE",
      `无效的 TTS voice "${String(cfg.voice)}"，仅支持 "stella" 或 "tide"`);
  }
  const raw = typeof text === "string" ? text : "";
  const hasOverride = typeof override === "string" && override !== "";
  const spoken = hasOverride ? override : raw;
  if (spoken.trim() === "" && !hasCfgText) {
    addIssue(ctx, path, "EMPTY_TTS_TEXT",
      "TTS 实际朗读文本不能为空或纯空白");
    return;
  }
  if (EDGE_SPACE_RE.test(raw) || (hasOverride && EDGE_SPACE_RE.test(override))) {
    addIssue(ctx, path, "SEGMENT_WHITESPACE_BOUNDARY",
      "TTS 文本首尾包含空白字符，应将空格移到相邻纯 text 切片");
  }
  if (QUOTE_WRAP_RE.test(spoken) || (!hasOverride && QUOTE_WRAP_RE.test(raw))) {
    addIssue(ctx, path, "SEGMENT_QUOTE_BOUNDARY",
      "TTS 文本外围包含成对引号或反引号，请将其移到外围纯 text 切片或去掉");
  }
  if (!opts.allowOmittedVoice && LATIN_RE.test(spoken) && !HAN_RE.test(spoken) &&
      !cfg?.voice && !opts.inheritedVoice) {
    addIssue(ctx, path, "ENGLISH_TTS_MISSING_VOICE",
      "英文 TTS 缺少显式 voice（应指定 \"stella\" 或 \"tide\"）");
  }
  if (HAN_RE.test(spoken) && EN_WORD_RE.test(spoken)) {
    addIssue(ctx, path, "MIXED_ZH_EN_TTS",
      "同一 TTS 片段混杂中文与英文，建议按语种拆分、使用纯语种 tts.text 或留纯文本");
  }
  if (ALL_CAPS_WORD_RE.test(spoken)) {
    addIssue(ctx, path, "ALL_CAPS_TTS_WITHOUT_OVERRIDE",
      "TTS 实际朗读文本包含连续纯大写英文词，会按字母拼读，请配置小写或正常大小写的 tts.text");
  }
  checkNonSpeakable(ctx, path, spoken, { forbidPlaceholders: opts.forbidPlaceholders });
  checkCoarseSegment(ctx, path, spoken, opts.allowCoarse);
}

function hasBlankSegment(stem) {
  return Array.isArray(stem) && stem.some((seg) => seg.type === "blank");
}

function checkUnvoicedStem(ctx, field, stem, opts) {
  if (opts.forbidTts || opts.skipUnvoicedStem) return;
  const raw = typeof stem === "string" ? stem
    : Array.isArray(stem) ? stem.map((s) => s.text || "").join("") : "";
  const cleaned = cleanUnvoicedText(raw);
  if (NON_SPEAKABLE_RE.test(cleaned)) return;
  if (opts.isSubQuestion && EN_WORD_RE.test(cleaned) && !HAN_RE.test(raw)) {
    addIssue(ctx, field, "UNVOICED_ENGLISH_SUBQUESTION",
      "纯英文小题题干未配置 TTS，建议拆分或声明语音", "warning");
    return;
  }
  if (EN_SENTENCE_RE.test(cleaned)) {
    const label = opts.fieldLabel || (field === "passage" ? "阅读短文" : "题干");
    addIssue(ctx, field, "UNVOICED_ENGLISH_SENTENCE",
      `${label}包含完整英文句子却未配置 TTS，建议拆分为 ContentSegment 并配语音`, "warning");
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
    if (usesPinyin && usesTts) {
      addIssue(ctx, path, "PINYIN_TTS_CONFLICT",
        "同一切片同时声明了 pinyin 与 tts，前端优先播放 pinyin 并忽略 tts", "warning");
    }
    if (seg.type === "speech" && !usesPinyin && !usesTts && !opts.sequenceMode) {
      addIssue(ctx, path, "SPEECH_TYPE_WITHOUT_AUDIO",
        "type 为 speech 但未声明 tts、tts_text 或 pinyin，前端将静默渲染为纯文本");
    }
    if (!usesTts) return;
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
  if (!hasAnyTts && !hasBlank) {
    checkUnvoicedStem(ctx, field, segments, opts);
    return;
  }
  if (opts.checkPartialPassage && hasAnyTts) {
    segments.forEach((seg, idx) => {
      if (seg.type === "blank" || seg.pinyin?.length ||
          hasTts(seg.tts) || seg.tts_text) {
        return;
      }
      const cleaned = cleanUnvoicedText(seg.text);
      if (!NON_SPEAKABLE_RE.test(cleaned) && EN_SENTENCE_RE.test(cleaned)) {
        addIssue(ctx, `${field}[${idx}]`, "PARTIAL_PASSAGE_TTS",
          "阅读短文已启用 TTS，但仍有完整英文句子留在无语音的纯文本切片中", "warning");
      }
    });
  }
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
    const usesPinyin = Array.isArray(opt.pinyin) && opt.pinyin.length > 0;
    const usesTts = hasTts(opt.tts);
    if (usesPinyin && usesTts) {
      addIssue(ctx, `${field}[${idx}]`, "PINYIN_TTS_CONFLICT",
        "同一选项同时声明了 pinyin 与 tts，前端优先播放 pinyin 并忽略 tts", "warning");
    }
    if (!usesTts) return;
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
    const cleaned = stripBackticks(analysis);
    if (!NON_SPEAKABLE_RE.test(cleaned) &&
        (cleaned.match(/[A-Za-z]{2,}/g) ?? []).length >= 2) {
      addIssue(ctx, field, "PARTIAL_ANALYSIS_TTS",
        "v2 解析包含英文短语/例句但未配语音切片", "warning");
    }
    return;
  }
  if (!Array.isArray(analysis)) return;
  checkSegments(ctx, field, analysis, { skipUnvoicedStem: true });
  const hasAnyTts = analysis.some((s) => hasTts(s.tts) || Boolean(s.tts_text));
  if (!hasAnyTts) {
    const joined = analysis
      .filter((s) => !s.pinyin?.length && s.type !== "blank")
      .map((s) => stripBackticks(s.text))
      .join(" ");
    if (!NON_SPEAKABLE_RE.test(joined) &&
        (joined.match(/[A-Za-z]{2,}/g) ?? []).length >= 2) {
      addIssue(ctx, field, "PARTIAL_ANALYSIS_TTS",
        "v2 解析包含英文短语/例句但未配语音切片", "warning");
    }
    return;
  }
  analysis.forEach((seg, idx) => {
    if (hasTts(seg.tts) || seg.tts_text || seg.pinyin?.length || seg.type === "blank") {
      return;
    }
    const cleaned = stripBackticks(seg.text);
    if (!NON_SPEAKABLE_RE.test(cleaned) && EN_WORD_RE.test(cleaned)) {
      addIssue(ctx, `${field}[${idx}]`, "PARTIAL_ANALYSIS_TTS",
        "解析已启用 TTS，但同段内英文内容仍留在无语音的纯文本切片中", "warning");
    }
  });
}

function isRecordingItem(item) {
  return (typeof item.audio === "string" && item.audio.trim() !== "") ||
    Boolean(item.audio && typeof item.audio === "object" &&
      item.audio.mode === "recording");
}

function inheritedLineVoice(item, speaker) {
  const audio = item.audio;
  if (!audio || typeof audio !== "object") return false;
  const tag = String(speaker || "").trim().toLowerCase();
  if (tag === "m") return Boolean(audio.voice_male);
  if (tag === "w") return Boolean(audio.voice_female);
  return false;
}

function checkTranscript(ctx, item) {
  if (!Array.isArray(item.transcript)) return;
  const recording = isRecordingItem(item);
  const isListening = item.type === "listening";
  item.transcript.forEach((line, idx) => {
    const path = `transcript[${idx}]`;
    if (line.tts === false) {
      if (!recording) {
        addIssue(ctx, path, "TRANSCRIPT_TTS_DISABLED",
          "听力逐字稿行禁用 tts 将导致无法合成播放");
      }
      return;
    }
    if (!hasTts(line.tts) && (!isListening || recording)) return;
    const inherited = isListening && !recording
      ? inheritedLineVoice(item, line.speaker) : false;
    checkTextContent(ctx, path, line.text, line.tts, undefined, {
      inheritedVoice: inherited,
      allowCoarse: true,
    });
  });
}

function checkListeningPassage(ctx, item) {
  const voiceFemale = Boolean(item.audio?.voice_female);
  if (typeof item.passage === "string") {
    checkTextContent(ctx, "passage", item.passage, undefined, undefined, {
      inheritedVoice: voiceFemale,
      allowCoarse: true,
    });
    return;
  }
  if (!Array.isArray(item.passage)) return;
  item.passage.forEach((seg, idx) => {
    if (hasTts(seg.tts) || Boolean(seg.tts_text)) {
      addIssue(ctx, `passage[${idx}]`, "LISTENING_PASSAGE_INLINE_TTS",
        "listening mode: \"passage\" 由服务端拼接整段后按 voice_female 朗读，切片内嵌 tts/tts_text 会被忽略");
    }
  });
  const joined = item.passage.map((s) => s.text || "").join("");
  if (joined) {
    checkTextContent(ctx, "passage", joined, undefined, undefined, {
      inheritedVoice: voiceFemale,
      allowCoarse: true,
    });
  }
}

function checkWriting(ctx, item) {
  if (item.type !== "writing" || !item.sample_response) return;
  if (Array.isArray(item.sample_response)) {
    if (hasTts(item.sample_response_tts)) {
      addIssue(ctx, "sample_response_tts", "WRITING_REDUNDANT_SAMPLE_TTS",
        "sample_response 为切片数组时，前端会忽略题级 sample_response_tts，请删除冗余的 sample_response_tts",
        "warning");
    }
    checkSegments(ctx, "sample_response", item.sample_response,
      { skipUnvoicedStem: true, allowCoarse: true });
    const hasAny = item.sample_response.some(
      (s) => hasTts(s.tts) || Boolean(s.tts_text),
    );
    if (!hasAny) {
      addIssue(ctx, "sample_response", "WRITING_MISSING_SAMPLE_TTS",
        "writing 题型提供了范文切片但未配置任何 tts");
      return;
    }
    item.sample_response.forEach((seg, idx) => {
      const voiced = hasTts(seg.tts) || Boolean(seg.tts_text);
      if (!voiced) {
        if ((seg.text || "").trim() && EN_WORD_RE.test(seg.text || "")) {
          addIssue(ctx, `sample_response[${idx}]`, "UNVOICED_ENGLISH_SENTENCE",
            "writing 范文段落包含英文内容但未配置 tts", "warning");
        }
        return;
      }
      const spoken = seg.tts_text || ttsObj(seg.tts)?.text || seg.text || "";
      if (spoken.includes("\n")) {
        addIssue(ctx, `sample_response[${idx}]`, "WRITING_UNNORMALIZED_NEWLINE",
          "writing 范文 TTS 实际朗读文本包含换行符 \\n，请通过 tts.text 规范为空格或使用 \\n\\n 段落分隔",
          "warning");
      }
    });
    return;
  }
  const hasMultiPara = typeof item.sample_response === "string" &&
    /\n\n/.test(item.sample_response);
  if (hasMultiPara) {
    addIssue(ctx, "sample_response", "COARSE_TTS_SEGMENT",
      "多段 writing 范文应拆为 ContentSegment[] 按段落配 tts", "warning");
  }
  if (!hasTts(item.sample_response_tts)) {
    addIssue(ctx, "sample_response_tts", "WRITING_MISSING_SAMPLE_TTS",
      "writing 题型提供了范文但缺少 sample_response_tts");
    return;
  }
  checkTextContent(ctx, "sample_response_tts", item.sample_response,
    item.sample_response_tts, undefined, { allowCoarse: true });
  const spoken = ttsObj(item.sample_response_tts)?.text ||
    (typeof item.sample_response === "string" ? item.sample_response : "");
  if (spoken.includes("\n") &&
      (!hasMultiPara || Boolean(ttsObj(item.sample_response_tts)?.text))) {
    addIssue(ctx, "sample_response_tts", "WRITING_UNNORMALIZED_NEWLINE",
      "writing 范文 TTS 实际朗读文本包含换行符 \\n，请通过 tts.text 规范为空格或拆分为段落切片",
      "warning");
  }
}

function checkTranslationField(ctx, ttsField, text, tts, missingRule, missingMsg) {
  if (!text && !hasTts(tts)) return;
  if (text && !hasTts(tts)) {
    addIssue(ctx, ttsField, missingRule, missingMsg);
    return;
  }
  checkTextContent(ctx, ttsField, text || "", tts, undefined, { allowCoarse: true });
}

function checkOffDirectionTranslationTts(ctx, ttsField, text, tts) {
  if (!hasTts(tts)) return;
  checkTextContent(ctx, ttsField, text || "", tts, undefined, { allowCoarse: true });
  const spoken = ttsObj(tts)?.text || text || "";
  if (HAN_RE.test(spoken) && !LATIN_RE.test(spoken)) {
    addIssue(ctx, ttsField, "TRANSLATION_OFF_DIRECTION_TTS",
      `translation 非目标外语字段（纯中文）无需配置 ${ttsField}，建议留纯文本`,
      "warning");
  }
}

function checkTranslation(ctx, item) {
  if (item.type !== "translation") return;
  if (item.direction === "en_to_zh") {
    checkTranslationField(
      ctx,
      "source_text_tts",
      item.source_text,
      item.source_text_tts,
      "TRANSLATION_MISSING_SOURCE_TTS",
      "英译中题型提供了英文原文但缺少 source_text_tts",
    );
    checkOffDirectionTranslationTts(
      ctx,
      "reference_translation_tts",
      item.reference_translation,
      item.reference_translation_tts,
    );
    return;
  }
  if (item.direction === "zh_to_en") {
    checkTranslationField(
      ctx,
      "reference_translation_tts",
      item.reference_translation,
      item.reference_translation_tts,
      "TRANSLATION_MISSING_REFERENCE_TTS",
      "中译英题型提供了英文参考译文但缺少 reference_translation_tts",
    );
    checkOffDirectionTranslationTts(
      ctx,
      "source_text_tts",
      item.source_text,
      item.source_text_tts,
    );
    return;
  }
  if (hasTts(item.source_text_tts)) {
    checkTextContent(ctx, "source_text_tts", item.source_text || "",
      item.source_text_tts, undefined, { allowCoarse: true });
  }
  if (hasTts(item.reference_translation_tts)) {
    checkTextContent(ctx, "reference_translation_tts",
      item.reference_translation || "", item.reference_translation_tts,
      undefined, { allowCoarse: true });
  }
}

function checkCloze(ctx, item) {
  if (item.type !== "cloze" || !item.passage_tts) return;
  if (item.passage_tts === true) {
    addIssue(ctx, "passage_tts", "TTS_BOOLEAN_SHORTHAND",
      "禁止使用 tts: true 简写，请改为显式对象（如 {\"voice\": \"stella\", \"text\": \"...\"}）");
    return;
  }
  const cfg = ttsObj(item.passage_tts);
  const spoken = cfg?.text;
  if (!spoken || !spoken.trim() || /\{\{\d+\}\}/.test(spoken)) {
    addIssue(ctx, "passage_tts", "CLOZE_PASSAGE_TTS_INCOMPLETE",
      "cloze passage_tts 必须单独配置填入答案后的完整英文句子 tts.text（不得含占位符）");
    return;
  }
  checkTextContent(ctx, "passage_tts", spoken, { ...cfg, text: undefined }, undefined,
    { allowCoarse: true });
}

function checkSubItems(ctx, item) {
  if (Array.isArray(item.blanks)) {
    item.blanks.forEach((blank, idx) => {
      checkOptions(ctx, `blanks[${idx}].options`, blank.options,
        { skipUnvoicedCheck: true });
      checkAnalysis(ctx, `blanks[${idx}].explanation`, blank.explanation);
    });
  }
  if (Array.isArray(item.sub_questions)) {
    item.sub_questions.forEach((sub, idx) => {
      const p = `sub_questions[${idx}]`;
      checkSegments(ctx, `${p}.stem`, sub.stem,
        { checkBlankCooccur: true, isSubQuestion: true });
      checkOptions(ctx, `${p}.options`, sub.options,
        { skipUnvoicedCheck: hasBlankSegment(sub.stem) });
      checkAnalysis(ctx, `${p}.analysis`, sub.analysis);
    });
  }
}

export function auditItems(items, file) {
  const issues = [];
  for (const item of items) {
    const ctx = { item, file, issues };
    const isReading = item.type === "reading_comprehension";
    if (isReading && (item.audio || item.transcript)) {
      addIssue(ctx, item.audio ? "audio" : "transcript", "READING_FORBIDS_MEDIA",
        "reading_comprehension 禁止声明 audio 或 transcript");
    }
    const isListening = !isReading &&
      (item.type === "listening" || Boolean(item.transcript) || Boolean(item.audio));
    checkSegments(ctx, "stem", item.stem, {
      checkBlankCooccur: true,
      forbidTts: isListening,
      forbidRule: "LISTENING_STEM_TTS_LEAK",
      forbidMessage: "听力题干禁止内嵌 TTS（避免逐字稿剧透）",
    });
    const isListeningPassage = isListening &&
      item.audio && typeof item.audio === "object" && item.audio.mode === "passage";
    if (isListeningPassage) {
      checkListeningPassage(ctx, item);
    } else {
      checkSegments(ctx, "passage", item.passage, {
        forbidTts: item.type === "cloze",
        forbidRule: "BLANK_TTS_COOCCURRENCE",
        forbidMessage: "cloze 短文禁止挂 TTS（避免误读填空占位符）",
        checkPartialPassage: isReading,
        fieldLabel: "阅读短文",
      });
    }
    checkOptions(ctx, "options", item.options,
      { skipUnvoicedCheck: hasBlankSegment(item.stem) });
    checkTranscript(ctx, item);
    checkAnalysis(ctx, "analysis", item.analysis);
    checkSegments(ctx, "explanation_audio", item.explanation_audio,
      { sequenceMode: true, allowCoarse: true, skipUnvoicedStem: true });
    checkWriting(ctx, item);
    checkTranslation(ctx, item);
    checkCloze(ctx, item);
    checkSubItems(ctx, item);
  }
  return issues;
}

function checkVocabularyField(ctx, field, text, tts) {
  const ttsField = `${field}_tts`;
  const hasText = typeof text === "string" && text.trim() !== "";
  const hasTtsConfig = tts !== undefined && tts !== null;
  if (!hasText) {
    const emptyPath = field === "term" || !hasTtsConfig ? field : ttsField;
    const emptyMsg = field === "term"
      ? "词条 term 不能为空，否则无法合成发音"
      : hasTtsConfig
        ? "配置了 example_tts 但缺少非空 example 文本"
        : "词条 example 不能为空白";
    addIssue(ctx, emptyPath, "EMPTY_TTS_TEXT", emptyMsg);
    if (typeof tts === "boolean") {
      addIssue(ctx, ttsField, "TTS_BOOLEAN_SHORTHAND",
        "禁止使用 tts 布尔简写，请改为显式对象（如 {\"voice\": \"stella\"}）");
    } else if (hasTtsConfig) {
      const cfg = ttsObj(tts);
      if (!cfg) {
        addIssue(ctx, ttsField, "INVALID_TTS_CONFIG",
          "TTS 配置必须是对象（如 {\"voice\": \"stella\"}）");
      } else if (cfg.voice !== undefined && !VALID_VOICES.has(cfg.voice)) {
        addIssue(ctx, ttsField, "INVALID_TTS_VOICE",
          `无效的 TTS voice "${String(cfg.voice)}"，仅支持 "stella" 或 "tide"`);
      }
    }
    return;
  }
  const cfg = ttsObj(tts);
  const path = hasTtsConfig && (!cfg || cfg.text !== undefined ||
    (cfg.voice !== undefined && !VALID_VOICES.has(cfg.voice)))
    ? ttsField
    : field;
  checkTextContent(ctx, path, text, tts, undefined, {
    allowOmittedVoice: true,
    forbidPlaceholders: true,
  });
}

export function auditVocabulary(entries, file) {
  const issues = [];
  if (!Array.isArray(entries)) return issues;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      issues.push({
        severity: "error",
        file,
        itemId: "(unknown)",
        path: "(entry)",
        rule: "INVALID_VOCABULARY_ENTRY",
        message: "词表条目必须是 JSON 对象",
      });
      continue;
    }
    const ctx = { item: entry, file, issues };
    checkVocabularyField(ctx, "term", entry.term, entry.term_tts);
    if (entry.example !== undefined || entry.example_tts !== undefined) {
      checkVocabularyField(ctx, "example", entry.example, entry.example_tts);
    }
  }
  return issues;
}
