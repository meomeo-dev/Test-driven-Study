import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditVocabularyEntries } from "../scripts/lib/audit.mjs";
import { auditCourseVocabulary } from "../scripts/audit-course-vocabulary.mjs";

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(skillRoot, "..", "..", "..");
const cliPath = path.join(skillRoot, "scripts", "audit-course-vocabulary.mjs");

test("golden-course-template and beginner-english pass strict audit", () => {
  for (const id of ["golden-course-template", "beginner-english"]) {
    const res = auditCourseVocabulary({
      courseDir: path.join(repoRoot, "courses", id),
      strict: true,
    });
    assert.equal(res.ok, true, JSON.stringify(res.data.issues));
    assert.equal(res.data.errorCount, 0);
    assert.equal(res.data.warningCount, 0);
  }
});

test("rejects duplicate ids, unknown unit/question refs, filler and overlong grammar notes", () => {
  const unitMap = new Map([["u1", new Set(["q1"])]]);
  const entries = [
    {
      id: "bolt-a",
      unit_id: "u1",
      term: "bolt",
      meaning: "螺栓",
      category: "word",
      pos: "noun",
      grammar_note: "无",
      question_ids: ["q1", "missing-q"],
    },
    {
      id: "bolt-a",
      unit_id: "u2",
      term: "nut",
      meaning: "螺母",
      category: "word",
      pos: "n",
      grammar_note: "a".repeat(121),
      example: "Tighten the nut.",
      example_tts: { voice: "stella" },
      extra_field: true,
    },
  ];
  const { issues } = auditVocabularyEntries(entries, { unitQuestionMap: unitMap });
  const rules = new Set(issues.map((i) => i.rule));
  for (const expected of [
    "INVALID_POS",
    "FILLER_GRAMMAR_NOTE",
    "UNKNOWN_QUESTION_ID",
    "DUPLICATE_ENTRY_ID",
    "UNKNOWN_UNIT_ID",
    "OVERLONG_GRAMMAR_NOTE",
    "UNPAIRED_EXAMPLE",
    "UNKNOWN_KEY",
  ]) {
    assert.ok(rules.has(expected), `expected ${expected} in ${[...rules].join(",")}`);
  }
});

test("warns on word missing pos, non-word with pos, over-annotation, and unit without vocab", () => {
  const unitMap = new Map([
    ["u1", new Set(["q1"])],
    ["u2", new Set(["q2"])],
  ]);
  const entries = Array.from({ length: 9 }, (_, idx) => ({
    id: `chunk-${idx}`,
    unit_id: "u1",
    term: idx === 0 ? "glove" : `visitor badge ${idx}`,
    meaning: "词义",
    category: idx === 0 ? "word" : "word_group",
    ...(idx === 1 ? { pos: "n" } : {}),
    grammar_note: "不必要的解释",
    example: "Example.",
    example_translation: "例句。",
    question_ids: ["q1"],
  }));
  const { issues } = auditVocabularyEntries(entries, { unitQuestionMap: unitMap });
  const rules = new Set(issues.map((i) => i.rule));
  for (const expected of [
    "WORD_MISSING_POS",
    "NON_WORD_WITH_POS",
    "OVER_ANNOTATED_GRAMMAR",
    "UNIT_WITHOUT_VOCABULARY",
  ]) {
    assert.ok(rules.has(expected), `expected ${expected}`);
  }
});

test("CLI --help, --file, and exit codes 0..3 follow toolbox contract", () => {
  const help = execFileSync("node", [cliPath, "--help"], { encoding: "utf8" });
  assert.match(help, /audit-course-vocabulary/);

  const tmp = mkdtempSync(path.join(os.tmpdir(), "vocab-skill-"));
  try {
    mkdirSync(tmp, { recursive: true });
    const goodFile = path.join(tmp, "good.json");
    writeFileSync(
      goodFile,
      JSON.stringify([
        {
          id: "glove",
          unit_id: "u1",
          term: "glove",
          meaning: "手套",
          category: "word",
          pos: "n",
          example: "Wear a glove.",
          example_translation: "戴上手套。",
        },
      ]),
    );
    const out = execFileSync("node", [cliPath, "--file", goodFile, "--strict", "--json"], {
      encoding: "utf8",
    });
    assert.equal(JSON.parse(out).ok, true);

    assert.throws(() => execFileSync("node", [cliPath, "--unknown"]), (err) => err.status === 2);
    assert.throws(
      () => execFileSync("node", [cliPath, "--file", path.join(tmp, "missing.json")]),
      (err) => err.status === 3,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
