import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { main } from "../scripts/audit-course-tts.mjs";
import { auditItems } from "../scripts/lib/audit.mjs";

test("clean v1 and v2 items pass with zero issues", () => {
  const items = [
    {
      id: "clean-1",
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
    },
    {
      id: "clean-listening",
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
        },
      ],
    },
    {
      id: "clean-writing",
      type: "writing",
      subtype: "sentence_making",
      stem: "用 delivery 造句。",
      sample_response: "The delivery arrived.",
      sample_response_tts: { voice: "stella" },
    },
  ];
  assert.deepEqual(auditItems(items, "unit.json"), []);
});

test("detects structural errors: options, shorthand, blanks, leaks, boundaries", () => {
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
      transcript: [{ speaker: "M", text: "Look at `Stop!`", tts: { voice: "tide" } }],
      options: [
        { id: "a", text: "good -> better", tts: { voice: "stella" } },
        { id: "b", text: "放入2号盒", tts: {} },
        { id: "c", text: "g", tts: { voice: "stella" } },
        { id: "d", text: "m", tts: { voice: "stella" } },
      ],
    },
    {
      id: "bad-writing-and-mixed",
      type: "writing",
      stem: [{ type: "text", text: "David, 装配部 (Assembly)", tts: { voice: "stella" } }],
      sample_response: "Hello.",
    },
    {
      id: "bad-speech-and-cloze",
      type: "cloze",
      stem: [{ type: "speech", text: "Silent" }],
      passage: [{ type: "text", text: "Read this", tts: { voice: "stella" } }],
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
    "SPEECH_TYPE_WITHOUT_AUDIO",
  ]) {
    assert.ok(errorRules.has(expected), `expected error rule ${expected}`);
  }
});

test("detects warning rules: coarse passage, unvoiced English, partial analysis", () => {
  const items = [
    {
      id: "coarse-reading",
      type: "reading_comprehension",
      stem: "阅读通知。",
      passage: [{
        type: "text",
        text: "NOTICE\nFirst sentence. Second sentence. Third sentence.",
        tts: { voice: "stella" },
      }],
      sub_questions: [{
        id: "s1",
        type: "single_choice",
        stem: "Where are the gloves?",
        options: [
          { id: "a", text: "On the shelf." },
          { id: "b", text: "On the desk." },
        ],
        analysis: "第二位说话者说了 on the second shelf。",
      }],
    },
    {
      id: "plain-stem-and-partial-analysis",
      type: "true_false",
      stem: "判断对错：\nThe word equipment takes no plural s.",
      analysis: [
        { type: "text", text: "以 The delivery 作主语，用 " },
        { type: "text", text: "has moved", tts: { voice: "stella" } },
      ],
    },
  ];
  const issues = auditItems(items, "warn.json");
  const warnRules = new Set(
    issues.filter((it) => it.severity === "warning").map((it) => it.rule),
  );
  for (const expected of [
    "COARSE_TTS_SEGMENT",
    "UNVOICED_ENGLISH_SUBQUESTION",
    "UNVOICED_ENGLISH_OPTIONS",
    "UNVOICED_ENGLISH_SENTENCE",
    "PARTIAL_ANALYSIS_TTS",
  ]) {
    assert.ok(warnRules.has(expected), `expected warning rule ${expected}`);
  }
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
