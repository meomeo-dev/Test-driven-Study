// plan、synthesize、prune、verify 共用的入口：读配置与句库，逐个句库组比对。

import { planSet } from "./audio-state.mjs";
import { listOption, requireRoot, usageError } from "./cli.mjs";
import { loadConfig, loadPhrases, selectSets } from "./config.mjs";

/** 解析 --voice 与 --force；未知音色名按用法错误报告。 */
export function voiceOptions(set, values) {
  const known = Object.keys(set.voices);
  const voices = listOption(values.voice);
  const forceList = listOption(values.force);
  const force = forceList.includes("all") ? known : forceList;
  const unknown = [...new Set([...voices, ...force])].filter((voice) => !known.includes(voice));
  if (unknown.length) {
    throw usageError(`句库组 ${set.name} 没有音色：${unknown.join("、")}（已有 ${known.join("、")}）`);
  }
  return { voices, force };
}

/** 返回 { config, plans }；每个 plan 带句子数 phraseCount。 */
export function planAll(values) {
  const root = requireRoot(values);
  const config = loadConfig(root, values.config);
  const plans = selectSets(config, values.set).map((set) => {
    const phrases = loadPhrases(set, config.postprocess);
    return { ...planSet(config, set, phrases, voiceOptions(set, values)), phraseCount: phrases.length };
  });
  return { config, plans };
}

/** 一条合成任务的对外视图（文本与 JSON 输出共用）。 */
export function jobView(job) {
  const view = { set: job.set, voice: job.voice, file: job.rel, reason: job.reason, text: job.phrase.text };
  if (job.changed) view.changed = job.changed;
  return view;
}
