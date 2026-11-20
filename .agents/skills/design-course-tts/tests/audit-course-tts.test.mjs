import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { auditCourseTts, main } from "../scripts/audit-course-tts.mjs";
import { auditItems, auditVocabulary } from "../scripts/lib/audit.mjs";

const GOLDEN_EXTENDED = resolve(
  process.cwd(),
  "courses/golden-course-template/questions/extended-practice.json",
);
const GOLDEN_VOCAB = resolve(
  process.cwd(),
  "courses/golden-course-template/assets/vocabulary/english.json",
);

test("clean v1 and v2 items across all 9 question types pass with zero issues", () => {
  const items = [
    {
      id: "clean-single-choice",
      type: "single_choice",
      stem: [
        { type: "text", text: "班长问：" },
        { type: "text", text: "Are you OK?", tts: { voice: "tide" } },
        { type: "text", text: " 你回答：" },
      ],
      options: [
        { id: "a", text: "Yes, I am.", tts: { voice: "stella" } },
        { id: "b", text: "I", tts: { voice: "stella" } },
      ],
      analysis: [
        { type: "text", text: "不可使用 " },
        { type: "text", text: "`equipments` 或 operate -> operating，应说 " },
        { type: "text", text: "Yes, I am.", tts: { voice: "stella" } },
      ],
    },
    {
      id: "clean-multiple-choice",
      type: "multiple_choice",
      stem: [
        { type: "text", text: "质检员说：" },
        { type: "text", text: "We need twenty-four clean trays.", tts: { voice: "stella" } },
        { type: "text", text: " 请选择两项。" },
      ],
      options: [
        { id: "a", text: "需要的数量是 24" },
        { id: "b", text: "需要的物品是托盘（trays）" },
      ],
      analysis: [
        { type: "text", text: "twenty-four", tts: { voice: "stella" } },
        { type: "text", text: " 表示 24。" },
      ],
    },
    {
      id: "clean-true-false",
      type: "true_false",
      stem: [
        { type: "text", text: "判断正误：\n" },
        { type: "text", text: "The equipment works well.", tts: { voice: "stella" } },
      ],
      options: [
        { id: "t", text: "True", value: true },
        { id: "f", text: "False", value: false },
      ],
      analysis: "equipment 为不可数名词。",
    },
    {
      id: "clean-numeric-mixed-and-code",
      type: "numeric",
      stem: [
        { type: "text", text: "盘点：" },
        { type: "text", text: "There are eight red parts and seven blue parts.", tts: { voice: "tide" } },
        { type: "text", text: " 总数是多少？" },
      ],
      analysis: [
        { type: "text", text: "eight", tts: { voice: "stella" } },
        { type: "text", text: " 与 " },
        { type: "text", text: "seven", tts: { voice: "stella" } },
        { type: "text", text: " 相加得 8 + 7 = 15。" },
      ],
    },
    {
      id: "clean-numeric-python-code",
      type: "numeric",
      stem: "执行下列代码后，变量 total 的值是多少？\ntotal = 0\nfor i in range(2, 9, 2): total += i",
    },
    {
      id: "clean-listening-dialogue",
      type: "listening",
      stem: "听对话回答问题。",
      audio: { mode: "dialogue", voice_male: "tide", voice_female: "stella" },
      transcript: [
        { speaker: "M", text: "Where are the gloves?" },
        { speaker: "W", text: "On the shelf.", tts: { speed: 0.9 } },
      ],
      sub_questions: [
        {
          id: "q1",
          type: "true_false",
          stem: [{ type: "text", text: "Are they on the shelf?", tts: { voice: "stella" } }],
          analysis: "对话第二句给出存放位置。",
        },
        {
          id: "q2",
          type: "single_choice",
          stem: [
            { type: "text", text: "Put the box " },
            { type: "blank", index: 1 },
            { type: "text", text: "." },
          ],
          options: [
            { id: "a", text: "here" },
            { id: "b", text: "there" },
          ],
        },
      ],
    },
    {
      id: "clean-listening-passage",
      type: "listening",
      stem: "听库房通知并回答。",
      audio: { mode: "passage", voice_female: "stella" },
      passage: "The storeroom closes at four. Collect gloves before three thirty. Spare gloves are in the blue cabinet.",
      sub_questions: [
        {
          id: "q-num",
          type: "numeric",
          stem: [
            { type: "text", text: "At what hour will it close?", tts: { voice: "stella" } },
            { type: "text", text: " " },
            { type: "text", text: "Enter only the hour.", tts: { voice: "stella" } },
          ],
        },
      ],
    },
    {
      id: "clean-listening-recording",
      type: "listening",
      stem: "听送货录音并回答。",
      audio: { mode: "recording", src: "assets/audio/delivery-delay.mp3" },
      transcript: [
        { speaker: "W", text: "The driver will arrive at ten thirty." },
      ],
      sub_questions: [
        {
          id: "arrival-time",
          type: "single_choice",
          stem: [{ type: "text", text: "When will the driver arrive?", tts: { voice: "stella" } }],
          options: [
            { id: "a", text: "At 10:30 a.m.", tts: { voice: "stella", text: "At ten thirty a.m." } },
            { id: "b", text: "At 11:30 a.m.", tts: { voice: "stella", text: "At eleven thirty a.m." } },
          ],
        },
      ],
    },
    {
      id: "clean-reading",
      type: "reading_comprehension",
      stem: "阅读通知。",
      passage: [
        { type: "text", text: "WORKSHOP NOTICE" },
        { type: "text", text: "\n" },
        { type: "text", text: "LOCKER ROOM NOTICE", tts: { voice: "stella", text: "Locker room notice." } },
        { type: "text", text: "\n" },
        { type: "text", text: "The workshop opens at 8 a.m.", tts: { voice: "stella" } },
      ],
      sub_questions: [
        {
          id: "visitors",
          type: "multiple_choice",
          stem: [{ type: "text", text: "What must visitors do?", tts: { voice: "stella" } }],
          options: [
            { id: "sign", text: "Sign in.", tts: { voice: "stella" } },
            { id: "badge", text: "Wear a badge.", tts: { voice: "stella" } },
          ],
          analysis: "访客须登记并佩戴证件。",
        },
      ],
    },
    {
      id: "clean-writing-single",
      type: "writing",
      subtype: "sentence_making",
      stem: "用 delivery 造句。",
      sample_response: "The delivery arrived.",
      sample_response_tts: { voice: "stella" },
    },
    {
      id: "clean-writing-paragraphs",
      type: "writing",
      subtype: "short_essay",
      stem: "写一封英文邮件。",
      sample_response: [
        { type: "text", text: "Hi Mia,", tts: { voice: "stella" } },
        { type: "text", text: "\n\n" },
        { type: "text", text: "First sentence. Second sentence. Third sentence.", tts: { voice: "stella" } },
        { type: "text", text: "\n\n" },
        { type: "text", text: "Best,\nSam", tts: { voice: "stella", text: "Best, Sam" } },
      ],
    },
    {
      id: "clean-translation-en-to-zh",
      type: "translation",
      direction: "en_to_zh",
      stem: "将下列提示译成中文。",
      source_text: "Leave the signed checklist on the front desk.",
      source_text_tts: { voice: "stella" },
      reference_translation: "把已签字的清单留在前台。",
    },
    {
      id: "clean-translation-zh-to-en",
      type: "translation",
      direction: "zh_to_en",
      stem: "将下列提示译成英文。",
      source_text: "把清单留在前台。",
      reference_translation: "Leave the checklist on the front desk.",
      reference_translation_tts: { voice: "stella" },
    },
    {
      id: "clean-cloze-tts",
      type: "cloze",
      stem: "选词填空。",
      passage: "Every worker {{1}} sign.",
      passage_tts: { voice: "stella", text: "Every worker must sign." },
      blanks: [
        {
          index: 1,
          options: [
            { id: "must", text: "must", tts: { voice: "stella" } },
            { id: "has", text: "has", tts: { voice: "stella" } },
          ],
          explanation: [
            { type: "text", text: "must", tts: { voice: "stella" } },
            { type: "text", text: " 后接动词原形。" },
          ],
        },
      ],
    },
  ];
  assert.deepEqual(auditItems(items, "unit.json"), []);
});

test("golden-course-template extended-practice.json passes with zero issues", () => {
  const golden = JSON.parse(readFileSync(GOLDEN_EXTENDED, "utf8"));
  assert.deepEqual(auditItems(golden, "extended-practice.json"), []);
});

test("detects structural errors: options, shorthand, blanks, leaks, overrides, math", () => {
  const items = [
    {
      id: "bad-options",
      type: "single_choice",
      stem: [{ type: "text", text: " Stop!", tts: true }],
      options: [
        { id: "a", text: "Stop!", tts: { voice: "stella" } },
        { id: "b", text: "Go!" },
      ],
    },
    {
      id: "bad-blank-and-quote",
      type: "single_choice",
      stem: [
        { type: "text", text: "\"Hello\"", tts: { voice: "stella" } },
        { type: "blank", index: 1 },
      ],
    },
    {
      id: "bad-listening-and-symbols",
      type: "listening",
      stem: [{ type: "text", text: "Listen:", tts: { voice: "tide" } }],
      transcript: [
        { speaker: "M", text: "Look at `Stop!`", tts: { voice: "tide" } },
        { speaker: "W", text: "No audio", tts: false },
      ],
      options: [
        { id: "a", text: "good -> better", tts: { voice: "stella" } },
        { id: "b", text: "放入2号盒", tts: {} },
        { id: "c", text: "1 ÷ 4", tts: { voice: "stella" } },
        { id: "d", text: "8 + 7 = 15", tts: { voice: "stella" } },
      ],
    },
    {
      id: "bad-writing-and-mixed",
      type: "writing",
      stem: [
        { type: "text", text: "David, 装配部 (Assembly)", tts: { voice: "stella" } },
        {
          type: "text",
          text: "broken override",
          tts: { voice: "stella", text: "第 1 行 -> \"bad\"" },
        },
      ],
      sample_response: "Hello.",
    },
    {
      id: "bad-speech-and-cloze",
      type: "cloze",
      stem: [{ type: "speech", text: "Silent" }],
      passage: [{ type: "text", text: "Read this", tts: { voice: "stella" } }],
    },
    {
      id: "bad-translation-en-to-zh",
      type: "translation",
      direction: "en_to_zh",
      stem: "译成中文。",
      source_text: "Stop the line.",
    },
    {
      id: "bad-translation-zh-to-en",
      type: "translation",
      direction: "zh_to_en",
      stem: "译成英文。",
      source_text: "停线。",
      reference_translation: "Stop the line.",
    },
    {
      id: "bad-all-caps",
      type: "reading_comprehension",
      stem: "阅读通知。",
      audio: { mode: "dialogue", voice_male: "tide", voice_female: "stella" },
      passage: [
        { type: "text", text: "LOCKER ROOM NOTICE", tts: { voice: "stella" } },
      ],
    },
    {
      id: "bad-cloze-passage-tts",
      type: "cloze",
      stem: "选词填空。",
      passage: "Every worker {{1}} sign.",
      passage_tts: { voice: "stella", text: "Every worker {{1}} sign." },
    },
    {
      id: "bad-cloze-passage-tts-spoken",
      type: "cloze",
      stem: "选词填空。",
      passage: "Every worker {{1}} sign.",
      passage_tts: { voice: "stella", text: "\"Every worker ___ sign.\"" },
    },
  ];
  const issues = auditItems(items, "bad.json");
  const errorRules = new Set(
    issues.filter((it) => it.severity === "error").map((it) => it.rule),
  );
  for (const expected of [
    "UNIFORM_OPTION_AUDIO", "TTS_BOOLEAN_SHORTHAND", "SEGMENT_WHITESPACE_BOUNDARY",
    "SEGMENT_QUOTE_BOUNDARY", "BLANK_TTS_COOCCURRENCE", "LISTENING_STEM_TTS_LEAK",
    "NON_SPEAKABLE_IN_TTS", "WRITING_MISSING_SAMPLE_TTS", "MIXED_ZH_EN_TTS",
    "SPEECH_TYPE_WITHOUT_AUDIO", "TRANSLATION_MISSING_SOURCE_TTS",
    "TRANSLATION_MISSING_REFERENCE_TTS", "ALL_CAPS_TTS_WITHOUT_OVERRIDE",
    "CLOZE_PASSAGE_TTS_INCOMPLETE", "TRANSCRIPT_TTS_DISABLED", "READING_FORBIDS_MEDIA",
  ]) {
    assert.ok(errorRules.has(expected), `expected error rule ${expected}`);
  }
});

test("detects listening dialogue/passage, non-listening transcript, writing, translation errors", () => {
  const items = [
    {
      id: "bad-dialogue-missing-voice",
      type: "listening",
      stem: "听对话。",
      audio: { mode: "dialogue", voice_female: "stella" },
      transcript: [
        { speaker: "M", text: "Check the valve." },
        { speaker: "Bob", text: "LOCKER ROOM" },
      ],
    },
    {
      id: "bad-listening-passage-mode",
      type: "listening",
      stem: "听通知。",
      audio: { mode: "passage", voice_male: "tide" },
      passage: [
        { type: "text", text: "The storeroom closes at four.", tts: { voice: "stella" } },
      ],
    },
    {
      id: "bad-non-listening-transcript",
      type: "numeric",
      stem: "听录音作答。",
      transcript: [
        { speaker: "M", text: "Count the gloves.", tts: {} },
      ],
    },
    {
      id: "bad-writing-string-content",
      type: "writing",
      subtype: "sentence_making",
      stem: "造句。",
      sample_response: "LOCKER ROOM -> 1",
      sample_response_tts: {},
    },
    {
      id: "bad-translation-content",
      type: "translation",
      direction: "en_to_zh",
      stem: "翻译。",
      source_text: "LOCKER ROOM -> 1",
      source_text_tts: {},
    },
    {
      id: "bad-translation-shorthand",
      type: "translation",
      direction: "zh_to_en",
      stem: "翻译。",
      source_text: "关门。",
      reference_translation: "Close the door.",
      reference_translation_tts: true,
    },
  ];
  const issues = auditItems(items, "strict.json");
  const byRule = (rule) => issues.filter((it) => it.rule === rule);
  assert.ok(byRule("ENGLISH_TTS_MISSING_VOICE").length >= 5);
  assert.equal(byRule("LISTENING_PASSAGE_INLINE_TTS").length, 1);
  assert.equal(byRule("ALL_CAPS_TTS_WITHOUT_OVERRIDE").length, 3);
  assert.equal(byRule("NON_SPEAKABLE_IN_TTS").length, 2);
  assert.equal(byRule("TTS_BOOLEAN_SHORTHAND").length, 1);
});

test("detects warning rules across passage, analysis, pinyin conflict, writing, translation", () => {
  const items = [
    {
      id: "coarse-reading-partial-passage",
      type: "reading_comprehension",
      stem: "阅读通知。",
      passage: [
        { type: "text", text: "WORKSHOP NOTICE" },
        { type: "text", text: "\n" },
        {
          type: "text",
          text: "NOTICE\nFirst sentence. Second sentence. Third sentence.",
          tts: { voice: "stella" },
        },
        { type: "text", text: "\n" },
        { type: "text", text: "Visitors must wear a badge at all times." },
      ],
      sub_questions: [{
        id: "s1",
        type: "multiple_choice",
        stem: "判断：Where are the twenty-four gloves placed?",
        options: [
          { id: "a", text: "On the shelf." },
          { id: "b", text: "On the desk." },
        ],
        analysis: [
          { type: "text", text: "第二位说话者说了 on the second shelf。" },
        ],
      }],
    },
    {
      id: "plain-reading-passage-and-partial-analysis",
      type: "reading_comprehension",
      stem: "阅读短文。",
      passage: "The supervisor will collect the badges before visitors leave.",
      sub_questions: [{
        id: "s2",
        type: "single_choice",
        stem: "Where are the gloves?",
        options: [
          { id: "a", text: "Here", tts: { voice: "stella" } },
          { id: "b", text: "There" },
        ],
      }],
      analysis: [
        { type: "text", text: "以 The delivery 作主语，用 " },
        { type: "text", text: "has moved", tts: { voice: "stella" } },
      ],
    },
    {
      id: "hyphen-stem-and-pinyin-conflict",
      type: "single_choice",
      stem: [
        { type: "text", text: "We need twenty-four clean trays." },
        { type: "speech", text: "ie", pinyin: ["ye1"], tts: { voice: "stella" } },
      ],
      options: [
        { id: "a", text: "ye", pinyin: ["ye1"], tts: { voice: "stella" } },
      ],
    },
    {
      id: "cloze-blank-explanation-warning",
      type: "cloze",
      stem: "完形。",
      passage: "Every worker {{1}} sign.",
      passage_tts: { voice: "stella", text: "Every worker must sign." },
      blanks: [{
        index: 1,
        options: [{ id: "a", text: "must", tts: { voice: "stella" } }],
        explanation: "情态动词 must follow base verb.",
      }],
    },
    {
      id: "writing-warnings-array",
      type: "writing",
      subtype: "short_essay",
      stem: "写作。",
      sample_response: [
        { type: "text", text: "Hi Mia,", tts: { voice: "stella" } },
        { type: "text", text: "\n\n" },
        { type: "text", text: "Unvoiced English paragraph here." },
        { type: "text", text: "\n\n" },
        { type: "text", text: "Best,\nSam", tts: { voice: "stella" } },
      ],
      sample_response_tts: { voice: "stella" },
    },
    {
      id: "writing-warnings-missing-array-tts",
      type: "writing",
      subtype: "short_essay",
      stem: "写作。",
      sample_response: [
        { type: "text", text: "This sample has four English words without audio." },
      ],
    },
    {
      id: "writing-warnings-string-paragraphs",
      type: "writing",
      subtype: "full_essay",
      stem: "写作。",
      sample_response: "First paragraph.\n\nSecond paragraph.",
      sample_response_tts: { voice: "stella" },
    },
    {
      id: "translation-off-direction-warning",
      type: "translation",
      direction: "en_to_zh",
      stem: "翻译。",
      source_text: "Stop the line.",
      source_text_tts: { voice: "stella" },
      reference_translation: "停止生产线。",
      reference_translation_tts: { voice: "stella" },
    },
  ];
  const issues = auditItems(items, "warn.json");
  const warnRules = new Set(
    issues.filter((it) => it.severity === "warning").map((it) => it.rule),
  );
  for (const expected of [
    "COARSE_TTS_SEGMENT",
    "PARTIAL_PASSAGE_TTS",
    "UNVOICED_ENGLISH_SUBQUESTION",
    "UNVOICED_ENGLISH_OPTIONS",
    "UNVOICED_ENGLISH_SENTENCE",
    "PARTIAL_ANALYSIS_TTS",
    "PINYIN_TTS_CONFLICT",
    "WRITING_REDUNDANT_SAMPLE_TTS",
    "WRITING_UNNORMALIZED_NEWLINE",
    "TRANSLATION_OFF_DIRECTION_TTS",
  ]) {
    assert.ok(warnRules.has(expected), `expected warning rule ${expected}`);
  }
  const readingPassageWarn = issues.find(
    (it) => it.itemId === "plain-reading-passage-and-partial-analysis" && it.path === "passage",
  );
  assert.match(readingPassageWarn?.message ?? "", /^阅读短文/);
  const missingWriting = issues.filter(
    (it) => it.itemId === "writing-warnings-missing-array-tts",
  );
  assert.deepEqual(missingWriting.map((it) => it.rule), ["WRITING_MISSING_SAMPLE_TTS"]);
});

test("CLI supports --help, --file, and returns standard exit codes 0..3", async () => {
  assert.equal(await main(["--help"]), 0);
  assert.equal(await main([]), 2);
  assert.equal(await main(["--unknown"]), 2);
  const dir = mkdtempSync(join(tmpdir(), "audit-course-tts-"));
  try {
    assert.equal(await main([join(dir, "missing")]), 3);
    const qFile = join(dir, "q.json");
    writeFileSync(qFile, JSON.stringify([{ id: "q1", type: "numeric", stem: "1+1=?" }]));
    assert.equal(await main(["--file", qFile, "--json"]), 0);
    writeFileSync(qFile, JSON.stringify([{
      id: "q2",
      type: "single_choice",
      stem: "Pick",
      options: [{ id: "a", text: "Yes", tts: true }, { id: "b", text: "No" }],
    }]));
    assert.equal(await main(["--file", qFile]), 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("auditVocabulary passes clean entries and resolved *_tts.text overrides", () => {
  const entries = [
    {
      id: "glove",
      unit_id: "u1",
      term: "glove",
      meaning: "手套",
      category: "word",
      example: "Put on your gloves before you touch the parts.",
      example_translation: "接触零件前请戴上手套。",
    },
    {
      id: "checklist",
      unit_id: "u1",
      term: "checklist",
      meaning: "核对清单",
      category: "word",
    },
    {
      id: "my-name-is",
      unit_id: "u1",
      term: "My name is …",
      meaning: "我叫……",
      category: "phrase",
      term_tts: { voice: "stella", text: "My name is" },
      example: "My name is Mia Chen.",
      example_translation: "我叫陈米娅。",
      example_tts: { voice: "tide", speed: 0.9 },
    },
    {
      id: "ask-sb",
      unit_id: "u1",
      term: "ask (sb.) for help",
      meaning: "向某人求助",
      category: "phrase",
      term_tts: { text: "ask someone for help" },
    },
    {
      id: "yes-or-no",
      unit_id: "u1",
      term: "yes/no",
      meaning: "是或否",
      category: "phrase",
      term_tts: { voice: "stella", text: "yes or no" },
    },
  ];
  assert.deepEqual(auditVocabulary(entries, "assets/vocabulary/english.json"), []);
  const goldenVocab = JSON.parse(readFileSync(GOLDEN_VOCAB, "utf8"));
  assert.deepEqual(
    auditVocabulary(goldenVocab, "assets/vocabulary/english.json"),
    [],
  );
});

test("auditVocabulary flags ellipsis/placeholders without override, symbols, all-caps, and invalid voices", () => {
  const entries = [
    {
      id: "ellipsis-unicode",
      term: "My name is …",
    },
    {
      id: "ellipsis-ascii-with-voice-only",
      term: "Could you ...?",
      term_tts: { voice: "stella" },
    },
    {
      id: "slash-alt",
      term: "he/she",
    },
    {
      id: "paren-note",
      term: "ask (sb.)",
      example: "Ask (someone) before starting.",
    },
    {
      id: "invalid-example-voice",
      term: "valve",
      example: "Check the valve.",
      example_tts: { voice: "alloy" },
    },
    {
      id: "all-caps-term",
      term: "LOCKER ROOM",
    },
    {
      id: "empty-term",
      term: "   ",
      term_tts: true,
    },
    {
      id: "orphan-example-tts",
      term: "bolt",
      example_tts: { voice: "tide" },
    },
    {
      id: "arrow-symbol",
      term: "good -> better",
    },
  ];
  const issues = auditVocabulary(entries, "assets/vocabulary/english.json");
  const find = (id, path) =>
    issues.filter((it) => it.itemId === id && (!path || it.path === path));
  assert.deepEqual(find("ellipsis-unicode", "term").map((i) => i.rule), [
    "NON_SPEAKABLE_IN_TTS",
  ]);
  assert.deepEqual(
    find("ellipsis-ascii-with-voice-only", "term").map((i) => i.rule),
    ["NON_SPEAKABLE_IN_TTS"],
  );
  assert.deepEqual(find("slash-alt", "term").map((i) => i.rule), [
    "NON_SPEAKABLE_IN_TTS",
  ]);
  assert.deepEqual(find("paren-note", "term").map((i) => i.rule), [
    "NON_SPEAKABLE_IN_TTS",
  ]);
  assert.deepEqual(find("paren-note", "example").map((i) => i.rule), [
    "NON_SPEAKABLE_IN_TTS",
  ]);
  assert.deepEqual(find("invalid-example-voice", "example_tts").map((i) => i.rule), [
    "INVALID_TTS_VOICE",
  ]);
  assert.deepEqual(find("all-caps-term", "term").map((i) => i.rule), [
    "ALL_CAPS_TTS_WITHOUT_OVERRIDE",
  ]);
  assert.deepEqual(
    find("empty-term").map((i) => i.rule),
    ["EMPTY_TTS_TEXT", "TTS_BOOLEAN_SHORTHAND"],
  );
  assert.deepEqual(find("orphan-example-tts", "example_tts").map((i) => i.rule), [
    "EMPTY_TTS_TEXT",
  ]);
  assert.deepEqual(find("arrow-symbol", "term").map((i) => i.rule), [
    "NON_SPEAKABLE_IN_TTS",
  ]);
});

test("auditCourseTts reads and audits vocabulary_file alongside units and reports vocabularyChecked", async () => {
  const dir = mkdtempSync(join(tmpdir(), "audit-course-vocab-"));
  try {
    mkdirSync(join(dir, "questions"), { recursive: true });
    mkdirSync(join(dir, "assets", "vocabulary"), { recursive: true });
    writeFileSync(
      join(dir, "course.json"),
      JSON.stringify({
        protocol_version: 2,
        course_id: "vocab-test",
        version: "1.0.0",
        title: "Vocab Test",
        language: "en",
        vocabulary_file: "assets/vocabulary/english.json",
        units: [
          {
            id: "u1",
            title: "Unit 1",
            question_file: "questions/u1.json",
          },
        ],
      }),
    );
    writeFileSync(
      join(dir, "questions", "u1.json"),
      JSON.stringify([{ id: "q1", type: "numeric", stem: "1+1=?" }]),
    );
    writeFileSync(
      join(dir, "assets", "vocabulary", "english.json"),
      JSON.stringify([
        {
          id: "my-name-is",
          unit_id: "u1",
          term: "My name is …",
          meaning: "我叫……",
          category: "phrase",
          term_tts: { voice: "stella", text: "My name is" },
        },
        {
          id: "glove",
          unit_id: "u1",
          term: "glove",
          meaning: "手套",
          category: "word",
          example: "Wear a glove.",
          example_translation: "戴上手套。",
        },
      ]),
    );

    const cleanRes = auditCourseTts(dir);
    assert.equal(cleanRes.exitCode, 0);
    assert.equal(cleanRes.data.ok, true);
    assert.equal(cleanRes.data.filesChecked, 1);
    assert.equal(cleanRes.data.itemsChecked, 1);
    assert.equal(cleanRes.data.vocabularyChecked, 2);
    assert.equal(cleanRes.data.vocabularyFile, "assets/vocabulary/english.json");
    assert.deepEqual(cleanRes.data.issues, []);

    writeFileSync(
      join(dir, "assets", "vocabulary", "english.json"),
      JSON.stringify([
        {
          id: "bad-ellipsis",
          unit_id: "u1",
          term: "My name is …",
          meaning: "我叫……",
          category: "phrase",
        },
        {
          id: "bad-voice",
          unit_id: "u1",
          term: "glove",
          meaning: "手套",
          category: "word",
          example: "Wear a glove.",
          example_translation: "戴上手套。",
          example_tts: { voice: "nova" },
        },
      ]),
    );

    const badRes = auditCourseTts(dir);
    assert.equal(badRes.exitCode, 1);
    assert.equal(badRes.data.ok, false);
    assert.equal(badRes.data.vocabularyChecked, 2);
    assert.equal(badRes.data.errorCount, 2);
    assert.deepEqual(
      badRes.data.issues.map((i) => ({
        file: i.file,
        itemId: i.itemId,
        path: i.path,
        rule: i.rule,
      })),
      [
        {
          file: "assets/vocabulary/english.json",
          itemId: "bad-ellipsis",
          path: "term",
          rule: "NON_SPEAKABLE_IN_TTS",
        },
        {
          file: "assets/vocabulary/english.json",
          itemId: "bad-voice",
          path: "example_tts",
          rule: "INVALID_TTS_VOICE",
        },
      ],
    );
    assert.equal(await main([dir, "--json"]), 1);

    rmSync(join(dir, "assets", "vocabulary", "english.json"));
    assert.equal(await main([dir]), 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
