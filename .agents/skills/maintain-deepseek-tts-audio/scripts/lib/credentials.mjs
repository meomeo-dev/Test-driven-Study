// 读取 API Key：先看环境变量，再看使用者项目的凭据文件。
// 这里的函数只返回密钥本身给请求模块，其余输出只含变量名、文件路径与状态，从不含密钥的值。

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { notReady } from "./cli.mjs";

const BOM = "\uFEFF";
const ENV_NAME_LINE = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*([=:])/;
const NAME_LIMIT = 10;

/** 从 KEY=VALUE 文本中取出一个键的值；支持注释、export 前缀、成对引号与文件开头的 BOM。 */
export function parseEnvValue(content, name) {
  let value;
  for (const rawLine of content.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^export\s+/, "");
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 1 || line.slice(0, equals).trim() !== name) continue;
    let rest = line.slice(equals + 1).trim();
    const quote = rest[0];
    if ((quote === '"' || quote === "'") && rest.indexOf(quote, 1) > 0) {
      rest = rest.slice(1, rest.indexOf(quote, 1));
    } else {
      rest = rest.replace(/\s+#.*$/, "");
    }
    value = rest; // 同名键出现多次时取最后一次，与常见 dotenv 解析一致
  }
  return value;
}

/**
 * 凭据文件的结构摘要，供找不到 Key 时排查：只含变量名、行数与标志，从不含任何值。
 * names 是 KEY=VALUE 行的变量名；colonNames 是写成 KEY: value 的变量名；occurrences 与
 * lastEmpty 说明目标变量出现几次、最后一次（生效的那次）是否为空，lastRawFilled 说明那一行等号后
 * 是否其实有内容（有内容却解析为空，多半是引号多了或不成对）；commented 是被注释掉的次数；
 * otherLines 是既不是注释也不是 KEY=VALUE 的行数。
 */
export function inspectEnvFile(content, name) {
  const summary = { bom: content.startsWith(BOM), names: [], colonNames: [], occurrences: 0, lastEmpty: false, lastRawFilled: false, commented: 0, otherLines: 0 };
  for (const rawLine of content.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      if (ENV_NAME_LINE.exec(line.replace(/^#+\s*/, ""))?.[1] === name) summary.commented += 1;
      continue;
    }
    const match = ENV_NAME_LINE.exec(line);
    if (!match) {
      summary.otherLines += 1;
    } else if (match[2] === ":") {
      summary.colonNames.push(match[1]);
    } else {
      summary.names.push(match[1]);
      if (match[1] === name) {
        summary.occurrences += 1;
        summary.lastRawFilled = line.slice(line.indexOf("=") + 1).trim() !== "";
      }
    }
  }
  if (summary.occurrences) summary.lastEmpty = !parseEnvValue(content, name)?.trim();
  return summary;
}

/** 把结构摘要写成一句排查提示；只出现变量名与计数。 */
export function envFileHint(summary, name) {
  const unique = (items) => [...new Set(items)];
  const parts = [];
  const names = unique(summary.names);
  if (names.length) parts.push(`文件里的变量名：${names.slice(0, NAME_LIMIT).join("、")}${names.length > NAME_LIMIT ? " 等" : ""}`);
  else parts.push("文件里没有 KEY=VALUE 格式的行");
  if (summary.occurrences && summary.lastEmpty) {
    const quoteHint = summary.lastRawFilled ? "，但等号后有内容：检查引号是否多了或不成对，例如 \"\"sk-…\"" : "";
    parts.push(`${name} 出现 ${summary.occurrences} 次，生效的最后一次解析为空${quoteHint}`);
  }
  const caseMismatch = names.filter((item) => item !== name && item.toUpperCase() === name.toUpperCase());
  if (caseMismatch.length) parts.push(`大小写不同：${caseMismatch.join("、")}`);
  if (summary.colonNames.length) parts.push(`写成了冒号格式：${unique(summary.colonNames).slice(0, NAME_LIMIT).join("、")}（应为 KEY=VALUE）`);
  if (summary.commented) parts.push(`${name} 被注释掉 ${summary.commented} 次`);
  if (summary.otherLines) parts.push(`有 ${summary.otherLines} 行不是 KEY=VALUE 格式`);
  if (summary.bom) parts.push("文件以 BOM 开头（工具会忽略它）");
  return parts.join("；");
}

export function credentialFilePath(config) {
  return config.credentials.file === null ? null : resolve(config.root, config.credentials.file);
}

/** 文件权限是否只有所有者可读写（组与其他人没有任何权限）。 */
export function isOwnerOnly(path) {
  return (statSync(path).mode & 0o077) === 0;
}

/** 项目内的路径显示为相对项目根的路径，项目外的显示为绝对路径。 */
export function displayPath(root, path) {
  const rel = relative(root, path);
  return rel.startsWith("..") || isAbsolute(rel) ? path : rel;
}

/** 文件不存在时（init-project 的 dry-run）取最近的已存在上级目录作为 git 的工作目录。 */
function existingAncestor(path) {
  let dir = dirname(path);
  while (!existsSync(dir) && dirname(dir) !== dir) dir = dirname(dir);
  return dir;
}

/**
 * 凭据文件在 Git 中的状态：tracked、ignored、not-ignored 或 no-git。
 * 在文件所在位置运行 git，凭据文件放在项目之外的另一个仓库里时，按那个仓库判断。
 */
export function gitIgnoreStatus(path) {
  const cwd = existingAncestor(path);
  const rel = relative(cwd, path);
  const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", rel], { cwd });
  if (tracked.error || tracked.status === 128) return "no-git";
  if (tracked.status === 0) return "tracked";
  const ignored = spawnSync("git", ["check-ignore", "-q", "--", rel], { cwd });
  if (ignored.status === 0) return "ignored";
  return ignored.status === 1 ? "not-ignored" : "no-git";
}

/** check-setup 用：只报告凭据从哪里来、是否齐全，不返回值。 */
export function describeCredential(config, env = process.env) {
  const name = config.credentials.env;
  const path = credentialFilePath(config);
  const fromEnv = Boolean(env[name]?.trim());
  const file = { path: path && displayPath(config.root, path), exists: false };
  if (path && existsSync(path)) {
    file.exists = true;
    file.ownerOnly = isOwnerOnly(path);
    const content = readFileSync(path, "utf8");
    file.hasKey = Boolean(parseEnvValue(content, name)?.trim());
    if (!file.hasKey) file.hint = envFileHint(inspectEnvFile(content, name), name);
    file.git = gitIgnoreStatus(path);
  }
  const source = fromEnv ? "env" : file.hasKey ? "file" : null;
  return { name, source, fromEnv, file };
}

/** 合成用：返回 API Key；缺失时以「未就绪」报告变量名与文件路径。 */
export function readApiKey(config, env = process.env) {
  const name = config.credentials.env;
  const fromEnv = env[name]?.trim();
  if (fromEnv) return fromEnv;
  const path = credentialFilePath(config);
  const fromFile = path && existsSync(path) ? parseEnvValue(readFileSync(path, "utf8"), name)?.trim() : "";
  if (fromFile) return fromFile;
  const where = path ? `环境变量 ${name} 与凭据文件 ${displayPath(config.root, path)}` : `环境变量 ${name}`;
  throw notReady(`${where} 都没有 ${name}；运行 init-project 生成模板后填写，或设置环境变量`);
}
