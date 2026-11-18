// 七个工具共用的命令行外壳：参数解析、--help、--json、退出码与错误输出。
// 工具只提供帮助文本、选项表和 run()；run() 返回 { exitCode, data, text }。

import { realpathSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const EXIT = Object.freeze({ OK: 0, FAIL: 1, USAGE: 2, NOT_READY: 3 });

/** 带退出码的错误；message 只写变量名、路径与状态码，从不写密钥。 */
export class ToolError extends Error {
  constructor(message, exitCode = EXIT.FAIL, details = undefined) {
    super(message);
    this.exitCode = exitCode;
    this.details = details;
  }
}

export const usageError = (message) => new ToolError(message, EXIT.USAGE);
export const notReady = (message, details) => new ToolError(message, EXIT.NOT_READY, details);
export const failure = (message, details) => new ToolError(message, EXIT.FAIL, details);

export const COMMON_OPTIONS = Object.freeze({
  root: { type: "string" },
  config: { type: "string" },
  set: { type: "string", multiple: true },
  json: { type: "boolean", default: false },
  verbose: { type: "boolean", default: false },
  help: { type: "boolean", short: "h", default: false },
});

/** 进度与诊断只写 stderr，stdout 留给结果。 */
export function progress(values, message) {
  if (values.verbose) console.error(message);
}

/** --root 必须显式给出；相对路径按当前目录解析成绝对路径。 */
export function requireRoot(values) {
  if (!values.root) throw usageError("缺少 --root <使用者项目根目录>");
  return isAbsolute(values.root) ? values.root : resolve(values.root);
}

/** 逗号分隔或重复给出的列表参数，去重后返回。 */
export function listOption(value) {
  const items = [value ?? []].flat().flatMap((item) => String(item).split(","));
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

export function positiveInteger(value, name) {
  if (value === undefined) return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) throw usageError(`${name} 必须是正整数`);
  return number;
}

function printError(error, values) {
  console.error(`✗ ${error.message}`);
  if (values?.json) {
    const body = { ok: false, error: { message: error.message, details: error.details } };
    console.log(JSON.stringify(body, null, 2));
  }
}

/**
 * 解析参数并运行工具。返回退出码，不直接调用 process.exit，便于测试。
 * spec: { help, options, allowPositionals, run(values, positionals) }
 */
export async function runTool(spec, argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: { ...COMMON_OPTIONS, ...spec.options },
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

/** 直接执行时才运行；兼容经符号链接或 /var 与 /private/var 之类别名路径的调用。 */
export function isEntryPoint(moduleUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  let real = entry;
  try {
    real = realpathSync(entry);
  } catch {
    real = entry; // 路径无法解析时按原值比较
  }
  return [entry, real].some((path) => pathToFileURL(path).href === moduleUrl);
}

/** 工具入口的统一写法：main 的结果写进 process.exitCode。 */
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
