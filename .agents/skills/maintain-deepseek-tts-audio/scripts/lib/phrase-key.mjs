// 句子原文到文件名键的映射：FNV-1a 64 位哈希，输入是原文的 UTF-8 字节，不做任何规范化，
// 输出 16 位小写十六进制。句子改一个字就是另一个键。算法写在 references/project-config.md，
// 使用者项目的运行时代码按同一算法计算键即可找到音频文件。

const OFFSET_BASIS = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK_64 = 0xffffffffffffffffn;

export function phraseKey(text) {
  let hash = OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * PRIME) & MASK_64;
  }
  return hash.toString(16).padStart(16, "0");
}
