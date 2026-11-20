import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const EXIT = Object.freeze({
  OK: 0,
  FAIL: 1,
  USAGE: 2,
  NOT_READY: 3,
});

export class ToolError extends Error {
  constructor(message, exitCode = EXIT.FAIL, details = undefined) {
    super(message);
    this.exitCode = exitCode;
    this.details = details;
  }
}

export const usageError = (msg) => new ToolError(msg, EXIT.USAGE);
export const notReady = (msg, details) =>
  new ToolError(msg, EXIT.NOT_READY, details);

function printError(error, values) {
  console.error(`✗ ${error.message}`);
  if (values?.json) {
    const body = { ok: false, error: { message: error.message } };
    if (error.details !== undefined) body.error.details = error.details;
    console.log(JSON.stringify(body, null, 2));
  }
}

export async function runTool(spec, argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        json: { type: "boolean", default: false },
        verbose: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
        ...spec.options,
      },
      allowPositionals: Boolean(spec.allowPositionals),
      strict: true,
    });
  } catch (error) {
    console.error(`✗ ${error.message}\n运行 --help 查看用法。`);
    return EXIT.USAGE;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    process.stdout.write(spec.help);
    return EXIT.OK;
  }
  try {
    const result = await spec.run(values, positionals);
    if (values.json) console.log(JSON.stringify(result.data, null, 2));
    else if (result.text) console.log(result.text);
    return result.exitCode;
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    printError(error, values);
    return error.exitCode;
  }
}

export function isEntryPoint(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  let real = entry;
  try {
    real = realpathSync(entry);
  } catch {
    real = entry;
  }
  return [entry, real].some((p) => pathToFileURL(p).href === moduleUrl);
}

export function startIfEntry(moduleUrl, main) {
  if (!isEntryPoint(moduleUrl)) return;
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      console.error(`✗ 内部错误：${error.stack ?? error.message}`);
      process.exitCode = EXIT.FAIL;
    },
  );
}
