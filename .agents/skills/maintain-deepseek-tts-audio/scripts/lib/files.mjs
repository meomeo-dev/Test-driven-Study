// 文件读写的小工具：原子写入、按扩展名遍历目录、删除空目录。

import { mkdirSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

/** 先写同目录的隐藏临时文件再改名，中途失败不会留下半个目标文件。 */
export function writeAtomic(target, data, mode) {
  mkdirSync(dirname(target), { recursive: true });
  const temp = join(dirname(target), `.${basename(target)}.partial-${process.pid}`);
  try {
    writeFileSync(temp, data, mode === undefined ? undefined : { mode });
    renameSync(temp, target);
  } catch (error) {
    try {
      unlinkSync(temp);
    } catch {
      // 临时文件可能尚未创建；原始错误更重要，继续抛出它
    }
    throw error;
  }
}

/** 列出目录下（递归）以 extensions 中任一扩展名结尾的普通文件，返回相对 dir 的 POSIX 路径。 */
export function listFiles(dir, extensions) {
  const found = [];
  const walk = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile() && !entry.name.startsWith(".") && extensions.some((extension) => entry.name.endsWith(extension))) {
        found.push(relative(dir, path).split("\\").join("/"));
      }
    }
  };
  walk(dir);
  return found.sort();
}

/** 自下而上删除 dir 内的空目录，不删除 dir 本身；返回删掉的相对路径。 */
export function removeEmptyDirs(dir) {
  const removed = [];
  const visit = (current) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
    let empty = true;
    for (const entry of entries) {
      if (!entry.isDirectory() || !visit(join(current, entry.name))) empty = false;
    }
    if (empty && current !== dir) {
      rmdirSync(current);
      removed.push(relative(dir, current).split("\\").join("/"));
    }
    return empty;
  };
  visit(dir);
  return removed;
}
