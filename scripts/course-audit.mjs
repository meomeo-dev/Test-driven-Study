#!/usr/bin/env node
// Unified course package audit CLI wrapping course:check, effort, TTS, and
// vocabulary quality gates.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

export const EXIT = Object.freeze({ OK: 0, FAIL: 1, USAGE: 2, NOT_READY: 3 });

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SCRIPT_DIR, "..");

const HELP = `course:audit — run all course package validation and quality gates

Usage:
  npm run course:audit -- [--strict] <course-dir>
  node scripts/course-audit.mjs [--strict] <course-dir>

Options:
  --strict      Forward --strict to effort and vocabulary auditors
  -h, --help    Show this help message

Gates (executed in order):
  1. course:check   go run ./cmd/course check <course-dir>
  2. effort         node scripts/audit-course-effort.mjs [--strict] <course-dir>
  3. tts            node .agents/skills/design-course-tts/scripts/audit-course-tts.mjs <course-dir>
  4. vocabulary     node .agents/skills/design-course-vocabulary/scripts/audit-course-vocabulary.mjs [--strict] <course-dir>
                    (SKIP when course.json does not declare vocabulary_file)

Exit codes: 0 all gates pass/skip; 1 one or more gates failed; 2 usage error; 3 missing path.
`;

export function parseAuditArgs(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        strict: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    return { error: err.message, exitCode: EXIT.USAGE };
  }
  const { values, positionals } = parsed;
  if (values.help) {
    return { help: true, strict: false, target: "" };
  }
  if (positionals.length !== 1) {
    return {
      error: "expected exactly one <course-dir> positional argument",
      exitCode: EXIT.USAGE,
    };
  }
  return { help: false, strict: values.strict, target: positionals[0] };
}

export function inspectManifest(courseDir) {
  const manifestPath = join(courseDir, "course.json");
  if (!existsSync(manifestPath)) {
    return { hasVocabulary: false };
  }
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const vocab = manifest?.vocabulary_file;
    return {
      hasVocabulary: typeof vocab === "string" && vocab.trim() !== "",
    };
  } catch {
    return { hasVocabulary: false };
  }
}

export function planAuditGates({
  courseDir,
  strict = false,
  hasVocabulary = false,
  repoRoot = REPO_ROOT,
  nodePath = process.execPath,
}) {
  const strictArgs = strict ? ["--strict"] : [];
  return [
    {
      name: "course:check",
      command: "go",
      args: ["run", "./cmd/course", "check", courseDir],
      skipReason: null,
    },
    {
      name: "effort",
      command: nodePath,
      args: [join(repoRoot, "scripts/audit-course-effort.mjs"), ...strictArgs, courseDir],
      skipReason: null,
    },
    {
      name: "tts",
      command: nodePath,
      args: [
        join(repoRoot, ".agents/skills/design-course-tts/scripts/audit-course-tts.mjs"),
        courseDir,
      ],
      skipReason: null,
    },
    {
      name: "vocabulary",
      command: nodePath,
      args: [
        join(
          repoRoot,
          ".agents/skills/design-course-vocabulary/scripts/audit-course-vocabulary.mjs",
        ),
        ...strictArgs,
        courseDir,
      ],
      skipReason: hasVocabulary ? null : "no vocabulary_file declared",
    },
  ];
}

function defaultRunner(command, args, cwd) {
  const res = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
  if (res.error) {
    return { status: 1, stdout: "", stderr: res.error.message };
  }
  return {
    status: res.status ?? 1,
    stdout: res.stdout ?? "",
    stderr: res.stderr ?? "",
  };
}

export function runCourseAudit({
  courseDir,
  strict = false,
  repoRoot = REPO_ROOT,
  runner = defaultRunner,
  manifestInspector = inspectManifest,
}) {
  const { hasVocabulary } = manifestInspector(courseDir);
  const gates = planAuditGates({ courseDir, strict, hasVocabulary, repoRoot });
  const results = [];
  for (const gate of gates) {
    if (gate.skipReason) {
      results.push({
        name: gate.name,
        status: "SKIP",
        reason: gate.skipReason,
        output: "",
      });
      continue;
    }
    const execRes = runner(gate.command, gate.args, repoRoot);
    const output = [execRes.stdout, execRes.stderr]
      .map((s) => (s ?? "").trim())
      .filter(Boolean)
      .join("\n");
    results.push({
      name: gate.name,
      status: execRes.status === 0 ? "PASS" : "FAIL",
      exitCode: execRes.status,
      output,
    });
  }
  const passed = results.filter((r) => r.status === "PASS").length;
  const skipped = results.filter((r) => r.status === "SKIP").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  return {
    ok: failed === 0,
    courseDir,
    strict,
    passed,
    skipped,
    failed,
    results,
  };
}

export function formatAuditReport(report) {
  const lines = [];
  for (const r of report.results) {
    const suffix = r.reason ? ` (${r.reason})` : "";
    lines.push(`[${r.status}] ${r.name}${suffix}`);
    if (r.output) {
      for (const line of r.output.split("\n")) {
        lines.push(`  ${line}`);
      }
    }
  }
  const verdict = report.ok ? "PASSED" : "FAILED";
  const mode = report.strict ? " [strict]" : "";
  lines.push(
    `Course audit ${verdict}${mode}: ${report.courseDir} ` +
      `(${report.passed} passed, ${report.skipped} skipped, ${report.failed} failed)`,
  );
  return lines.join("\n") + "\n";
}

export function main(argv = process.argv.slice(2), deps = {}) {
  const parsed = parseAuditArgs(argv);
  if (parsed.error) {
    process.stderr.write(`Error: ${parsed.error}\nRun with --help for usage.\n`);
    return parsed.exitCode;
  }
  if (parsed.help) {
    process.stdout.write(HELP);
    return EXIT.OK;
  }
  const courseDir = resolve(parsed.target);
  if (!existsSync(courseDir) || !statSync(courseDir).isDirectory()) {
    process.stderr.write(`Error: course directory not found: ${parsed.target}\n`);
    return EXIT.NOT_READY;
  }
  const report = runCourseAudit({
    courseDir,
    strict: parsed.strict,
    ...deps,
  });
  process.stdout.write(formatAuditReport(report));
  return report.ok ? EXIT.OK : EXIT.FAIL;
}

const isEntry =
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));

if (isEntry) {
  process.exitCode = main();
}
