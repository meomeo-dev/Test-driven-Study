import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import {
  EXIT,
  REPO_ROOT,
  formatAuditReport,
  main,
  parseAuditArgs,
  planAuditGates,
  runCourseAudit,
} from "./course-audit.mjs";

test("parseAuditArgs parses target, --strict, --help, and usage errors", () => {
  assert.deepEqual(parseAuditArgs(["courses/golden-course-template"]), {
    help: false,
    strict: false,
    target: "courses/golden-course-template",
  });
  assert.deepEqual(parseAuditArgs(["--strict", "courses/beginner-english"]), {
    help: false,
    strict: true,
    target: "courses/beginner-english",
  });
  assert.deepEqual(parseAuditArgs(["--help"]), {
    help: true,
    strict: false,
    target: "",
  });

  const missing = parseAuditArgs([]);
  assert.equal(missing.exitCode, EXIT.USAGE);
  const extra = parseAuditArgs(["courses/a", "courses/b"]);
  assert.equal(extra.exitCode, EXIT.USAGE);
  const unknown = parseAuditArgs(["--bogus", "courses/a"]);
  assert.equal(unknown.exitCode, EXIT.USAGE);
});

test("planAuditGates wires strict flags and skips vocabulary when absent", () => {
  const strictWithVocab = planAuditGates({
    courseDir: "/tmp/course",
    strict: true,
    hasVocabulary: true,
    repoRoot: REPO_ROOT,
  });
  assert.deepEqual(
    strictWithVocab.map((g) => g.name),
    ["course:check", "effort", "tts", "vocabulary"],
  );
  assert.ok(strictWithVocab[1].args.includes("--strict"));
  assert.ok(!strictWithVocab[2].args.includes("--strict"));
  assert.ok(strictWithVocab[3].args.includes("--strict"));
  assert.equal(strictWithVocab[3].skipReason, null);

  const noVocab = planAuditGates({
    courseDir: "/tmp/course",
    strict: false,
    hasVocabulary: false,
    repoRoot: REPO_ROOT,
  });
  assert.ok(!noVocab[1].args.includes("--strict"));
  assert.equal(noVocab[3].skipReason, "no vocabulary_file declared");
});

test("runCourseAudit aggregates PASS/SKIP/FAIL without short-circuiting", () => {
  const calls = [];
  const report = runCourseAudit({
    courseDir: "/tmp/fake-course",
    strict: true,
    manifestInspector: () => ({ hasVocabulary: false }),
    runner: (cmd, args) => {
      calls.push([cmd, ...args]);
      if (args.some((a) => a.includes("audit-course-tts"))) {
        return { status: 1, stdout: "", stderr: "tts issue found" };
      }
      return { status: 0, stdout: "ok", stderr: "" };
    },
  });
  assert.equal(calls.length, 3);
  assert.equal(report.ok, false);
  assert.equal(report.passed, 2);
  assert.equal(report.skipped, 1);
  assert.equal(report.failed, 1);
  assert.deepEqual(
    report.results.map((r) => [r.name, r.status]),
    [
      ["course:check", "PASS"],
      ["effort", "PASS"],
      ["tts", "FAIL"],
      ["vocabulary", "SKIP"],
    ],
  );
  const formatted = formatAuditReport(report);
  assert.match(formatted, /\[PASS\] course:check/);
  assert.match(formatted, /\[FAIL\] tts/);
  assert.match(formatted, /\[SKIP\] vocabulary \(no vocabulary_file declared\)/);
  assert.match(formatted, /Course audit FAILED \[strict\]/);
});

test("main returns NOT_READY for missing directory", () => {
  const code = main(["courses/does-not-exist-xyz"]);
  assert.equal(code, EXIT.NOT_READY);
});

test("golden-course-template passes all four audit gates end-to-end", () => {
  const report = runCourseAudit({
    courseDir: resolve(REPO_ROOT, "courses/golden-course-template"),
    strict: false,
  });
  assert.equal(report.ok, true, formatAuditReport(report));
  assert.equal(report.passed, 4);
  assert.equal(report.skipped, 0);
  assert.equal(report.failed, 0);
});

test("elementary-chinese passes strict audit and reports vocabulary SKIP", () => {
  const report = runCourseAudit({
    courseDir: resolve(REPO_ROOT, "courses/elementary-chinese"),
    strict: true,
  });
  assert.equal(report.ok, true, formatAuditReport(report));
  assert.equal(report.passed, 3);
  assert.equal(report.skipped, 1);
  assert.equal(report.failed, 0);
  assert.equal(report.results[3].name, "vocabulary");
  assert.equal(report.results[3].status, "SKIP");
});
