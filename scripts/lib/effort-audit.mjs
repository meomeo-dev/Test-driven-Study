import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const HAN_RE = /[\u4e00-\u9fff]/g;
const EN_WORD_RE = /[A-Za-z]+(?:[-'’][A-Za-z]+)*/g;
const H2_RE = /^##\s+(.+)$/gm;
const PLACEHOLDER_RE = /无资料|\bTODO\b|\bTBD\b|Replace this lesson/i;
const ANCHOR_CONCEPTS_RE = /<!--\s*concepts\s*:\s*([^>]+?)-->/gi;
const ANCHOR_LAB_RE = /<!--\s*effort-lab\s*:\s*([^>]+?)-->/i;

export const LAMBDA_STUDY = 1.8;
export const RHO_BANK = 1.45;

const SUB_WEIGHT = {
  true_false: 0.6,
  single_choice: 0.8,
  numeric: 0.9,
  multiple_choice: 1.0,
};

function countMatches(text, re) {
  const m = String(text || "").match(re);
  return m ? m.length : 0;
}

export function extractRichText(val) {
  if (typeof val === "string") return val;
  if (!Array.isArray(val)) return "";
  return val.map((seg) => (seg?.type === "blank" ? "" : seg?.text || "")).join("");
}

function itemHasAudio(item) {
  if (item.audio || (Array.isArray(item.transcript) && item.transcript.length > 0)) {
    return true;
  }
  const stemArr = Array.isArray(item.stem) ? item.stem : [];
  if (stemArr.some((s) => s?.tts || s?.tts_text || s?.pinyin?.length)) return true;
  const opts = Array.isArray(item.options) ? item.options : [];
  return opts.some((o) => o?.tts || o?.pinyin?.length);
}

/**
 * Estimate solve, explanation review, and total first-pass minutes for one item.
 */
export function calcItemEffort(item) {
  const type = item.type;
  const audioFlag = itemHasAudio(item) ? 1 : 0;
  const stemText = extractRichText(item.stem);
  const subs = Array.isArray(item.sub_questions) ? item.sub_questions : [];
  const subSum = subs.reduce((acc, s) => acc + (SUB_WEIGHT[s.type] ?? 0.8), 0);

  let solve = 0.9;
  let expl = 0.35;
  if (type === "true_false") {
    solve = 0.6 + 0.2 * audioFlag;
  } else if (type === "single_choice") {
    solve = 0.9 + 0.2 * audioFlag;
  } else if (type === "multiple_choice") {
    solve = 1.2 + 0.2 * audioFlag;
    expl = 0.4;
  } else if (type === "numeric") {
    solve = 1.1 + (countMatches(stemText, HAN_RE) > 60 ? 0.5 : 0);
  } else if (type === "cloze") {
    const pEn = countMatches(extractRichText(item.passage), EN_WORD_RE);
    const blanks = Array.isArray(item.blanks) ? item.blanks.length : 1;
    solve = 0.6 + 0.6 * blanks + pEn / 90;
    expl = 0.5;
  } else if (type === "reading_comprehension") {
    const pTxt = extractRichText(item.passage);
    solve =
      0.5 +
      countMatches(pTxt, HAN_RE) / 250 +
      countMatches(pTxt, EN_WORD_RE) / 90 +
      subSum;
    expl = 0.8;
  } else if (type === "listening") {
    const trText = Array.isArray(item.transcript)
      ? item.transcript.map((l) => l.text || "").join(" ")
      : extractRichText(item.passage);
    const spoken = Math.max(
      countMatches(trText, EN_WORD_RE),
      countMatches(trText, HAN_RE) / 3,
    );
    solve = 0.5 + 2.0 * Math.max(0.25, spoken / 110) + subSum;
    expl = 0.8;
  } else if (type === "translation") {
    const src = String(item.source_text || "");
    const rate = item.direction === "en_to_zh" ? countMatches(src, EN_WORD_RE) / 25 : countMatches(src, HAN_RE) / 35;
    const terms = Array.isArray(item.key_terms) ? item.key_terms.length : 0;
    solve = 1.0 + rate + 0.25 * terms;
    expl = 0.5;
  } else if (type === "writing") {
    const sub = item.subtype || "short_essay";
    const defMid = sub === "sentence_making" ? 12 : sub === "full_essay" ? 130 : 50;
    const mid = item.min_words && item.max_words ? (item.min_words + item.max_words) / 2 : defMid;
    const rates = { sentence_making: [1.5, 12, 0.8], short_essay: [2.0, 13, 1.2], full_essay: [3.0, 15, 1.5] };
    const [base, wpm, eMin] = rates[sub] || rates.short_essay;
    solve = base + mid / wpm;
    expl = eMin;
  }
  return { solveMin: solve, explMin: expl, totalMin: solve + expl };
}

function normTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function splitMarkdownSections(md) {
  const matches = [...String(md || "").matchAll(H2_RE)];
  if (matches.length === 0) return [{ title: "", body: String(md || "") }];
  const sections = [{ title: "", body: md.slice(0, matches[0].index) }];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i][0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : md.length;
    sections.push({ title: matches[i][1].trim(), body: md.slice(start, end) });
  }
  return sections;
}

function sectionReadingMetrics(body) {
  const cjk = countMatches(body, HAN_RE);
  const en = countMatches(body, EN_WORD_RE);
  const fenced = Math.floor(countMatches(body, /^```/gm) / 2);
  const examples = countMatches(body, /^###\s*(?:例题|常见错误|典型误区)/gm);
  const readMin = cjk / 250 + en / 90 + 0.15 * (fenced + examples);
  return { cjk, en, readMin };
}

function matchSectionConcepts(sec, concepts) {
  const cidSet = new Set(concepts.map((c) => c.id));
  const explicit = [];
  for (const m of sec.body.matchAll(ANCHOR_CONCEPTS_RE)) {
    for (const tok of m[1].split(/[\s,]+/)) {
      if (cidSet.has(tok.trim())) explicit.push(tok.trim());
    }
  }
  if (explicit.length > 0) return [...new Set(explicit)];
  const hNorm = normTitle(sec.title);
  if (!hNorm) return [];
  const exact = concepts.filter((c) => normTitle(c.title) === hNorm).map((c) => c.id);
  if (exact.length > 0) return exact;
  return concepts
    .filter((c) => {
      const cNorm = normTitle(c.title);
      return cNorm.length >= 3 && (hNorm.includes(cNorm) || cNorm.includes(hNorm));
    })
    .map((c) => c.id);
}

/**
 * Parse a lesson Markdown file and attribute reading effort across linked concepts
 * without double-counting shared framing prose.
 */
export function attributeLesson(md, concepts) {
  const perConcept = Object.fromEntries(
    concepts.map((c) => [c.id, { readMin: 0, cjk: 0, en: 0, matchedSections: [] }]),
  );
  if (concepts.length === 0) return { perConcept, totalReadMin: sectionReadingMetrics(md).readMin };

  const sections = splitMarkdownSections(md);
  let poolMin = 0;
  let poolCjk = 0;
  let poolEn = 0;
  let totalReadMin = 0;

  for (const sec of sections) {
    const metrics = sectionReadingMetrics(sec.body);
    totalReadMin += metrics.readMin;
    const owners = sec.title ? matchSectionConcepts(sec, concepts) : [];
    if (owners.length === 0) {
      poolMin += metrics.readMin;
      poolCjk += metrics.cjk;
      poolEn += metrics.en;
      continue;
    }
    const share = 1 / owners.length;
    for (const cid of owners) {
      perConcept[cid].readMin += metrics.readMin * share;
      perConcept[cid].cjk += metrics.cjk * share;
      perConcept[cid].en += metrics.en * share;
      perConcept[cid].matchedSections.push(sec);
    }
  }
  const poolShare = 1 / concepts.length;
  for (const cid of Object.keys(perConcept)) {
    perConcept[cid].readMin += poolMin * poolShare;
    perConcept[cid].cjk += poolCjk * poolShare;
    perConcept[cid].en += poolEn * poolShare;
  }
  return { perConcept, totalReadMin };
}

function calcLabEffort(matchedSections) {
  const text = matchedSections.map((s) => s.body).join("\n");
  const labMatch = text.match(ANCHOR_LAB_RE);
  if (labMatch) {
    const nums = [...labMatch[1].matchAll(/=\s*(\d+)/g)].map((m) => Number(m[1]));
    const sum = nums.filter((n) => n > 0).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      return { designMin: Math.min(600, sum), minPassMin: Math.min(600, sum * 0.65), anchored: true };
    }
  }
  const steps = countMatches(text, /^\s*\d+[.)、]/gm);
  const rubric = countMatches(text, /^\s*[-*]\s+/gm);
  if (steps > 0) {
    const designMin = 2.5 * steps + 1.5 * rubric + 2.5;
    const minPassMin = 1.5 * steps + 1.0 * rubric + 1.5;
    return { designMin, minPassMin, anchored: steps >= 2 && rubric >= 2 };
  }
  return { designMin: 3.5, minPassMin: 2.0, anchored: false };
}

function addFinding(issues, severity, rule, target, message) {
  issues.push({ severity, rule, target, message });
}

function loadUnitAssets(courseDir, unit, issues) {
  const lessonsById = {};
  for (const l of unit.lessons || []) {
    const fPath = join(courseDir, l.file);
    if (!existsSync(fPath)) {
      addFinding(issues, "error", "MISSING_LESSON_FILE", `${unit.id}/${l.id}`, `讲义文件不存在：${l.file}`);
      continue;
    }
    const md = readFileSync(fPath, "utf8");
    const bytes = Buffer.byteLength(md.trim(), "utf8");
    if (bytes < 80 || PLACEHOLDER_RE.test(md)) {
      addFinding(issues, "error", "EMPTY_OR_PLACEHOLDER_LESSON", `${unit.id}/${l.id}`, `讲义为空或含未完成占位文本（${l.file}）`);
    }
    lessonsById[l.id] = { meta: l, md };
  }
  let items = [];
  if (unit.question_file) {
    const qPath = join(courseDir, unit.question_file);
    if (!existsSync(qPath)) {
      addFinding(issues, "error", "MISSING_QUESTION_FILE", unit.id, `题库文件不存在：${unit.question_file}`);
    } else {
      items = JSON.parse(readFileSync(qPath, "utf8"));
    }
  }
  return { lessonsById, items };
}

function checkConceptFindings(cStat, unitId, issues) {
  const target = `${unitId}/${cStat.id}`;
  const est = cStat.declaredMinutes;
  const eta = cStat.ratio;
  if (est < 1 || est > 600) {
    addFinding(issues, "error", "CONCEPT_MINUTES_OUT_OF_RANGE", target, `estimated_minutes=${est} 超出 1..600 范围`);
  }
  if (cStat.itemCount === 0 && est > 30 && !cStat.labAnchored) {
    addFinding(issues, "error", "ZERO_ITEM_UNANCHORED_HIGH_HOURS", target, `零题概念声明 ${est} 分钟但缺少步骤/清单或 effort-lab 锚点`);
  } else if (est >= 15 && eta < 0.5) {
    addFinding(issues, "error", "SEVERE_UNDER_STUFFED_CONCEPT", target, `内容严重不足（估算 ${cStat.designMinutes}m / 声明 ${est}m，η=${eta}）`);
  } else if (eta > 2.5) {
    addFinding(issues, "error", "SEVERE_OVER_STUFFED_CONCEPT", target, `内容严重超载（估算 ${cStat.designMinutes}m / 声明 ${est}m，η=${eta}）`);
  } else if (eta < 0.7) {
    addFinding(issues, "warning", "UNDER_STUFFED_CONCEPT", target, `内容偏薄（估算 ${cStat.designMinutes}m / 声明 ${est}m，η=${eta}）`);
  } else if (eta > 1.4) {
    addFinding(issues, "warning", "OVER_STUFFED_CONCEPT", target, `内容偏重（估算 ${cStat.designMinutes}m / 声明 ${est}m，η=${eta}）`);
  }
  if (cStat.itemCount > 0 && cStat.itemCount < 3) {
    addFinding(issues, "warning", "SPARSE_CONCEPT_ITEMS", target, `仅有 ${cStat.itemCount} 道题（建议 >= 3）`);
  }
  if (cStat.itemCount > 0 && est > 0 && cStat.firstPassMinutes < 0.2 * est) {
    addFinding(issues, "warning", "FAST_MASTERY_BYPASS", target, `速通仅需 ${cStat.firstPassMinutes}m（不足声明 ${est}m 的 20%）`);
  }
  if (cStat.lessonId && !cStat.hasMatchedSection) {
    addFinding(issues, "warning", "MISSING_CONCEPT_SECTION", target, `关联讲义 ${cStat.lessonId} 中未匹配到对应 ## 小节或 concepts 锚点`);
  }
  if (cStat.lessonId && cStat.itemCount > 0 && est >= 20 && cStat.lecCjk + cStat.lecEn * 2 < 250) {
    addFinding(issues, "warning", "THIN_CONCEPT_PROSE", target, `对应讲义内容偏薄（约 ${Math.round(cStat.lecCjk)} 字）`);
  }
}

function evaluateUnit(courseDir, unit, issues) {
  const { lessonsById, items } = loadUnitAssets(courseDir, unit, issues);
  const concepts = unit.concepts || [];
  const lessonAttrs = {};
  for (const [lid, entry] of Object.entries(lessonsById)) {
    const linked = concepts.filter((c) => c.lesson === lid);
    lessonAttrs[lid] = attributeLesson(entry.md, linked);
  }
  const taggedItemsByConcept = Object.fromEntries(concepts.map((c) => [c.id, []]));
  const untaggedItems = [];
  for (const item of items) {
    const tags = Array.isArray(item.concepts) ? item.concepts : [];
    if (tags.length === 0) untaggedItems.push(item);
    for (const tid of tags) {
      if (taggedItemsByConcept[tid]) taggedItemsByConcept[tid].push({ item, k: tags.length });
    }
  }
  if (concepts.length > 0 && untaggedItems.length > 0) {
    addFinding(issues, "error", "UNTAGGED_ITEMS_IN_CONCEPT_COURSE", unit.id, `存在 ${untaggedItems.length} 道未关联 concepts 标签的题目`);
  }
  const untaggedDesign = RHO_BANK * untaggedItems.reduce((s, it) => s + calcItemEffort(it).totalMin, 0);

  const conceptStats = [];
  for (const c of concepts) {
    const attr = c.lesson && lessonAttrs[c.lesson]?.perConcept[c.id];
    const lecMin = attr ? attr.readMin : 0;
    const matched = attr ? attr.matchedSections : [];
    const linkedItems = taggedItemsByConcept[c.id] || [];
    const soloSolve = linkedItems.reduce((s, x) => s + calcItemEffort(x.item).solveMin, 0);
    const allocTotal = linkedItems.reduce((s, x) => s + calcItemEffort(x.item).totalMin / x.k, 0);
    const lab = linkedItems.length === 0 ? calcLabEffort(matched) : { designMin: 0, minPassMin: 0, anchored: true };
    const n = linkedItems.length;
    const passMin = lecMin + (n > 0 ? (Math.min(3, n) / n) * soloSolve : lab.minPassMin);
    const designMin = LAMBDA_STUDY * lecMin + RHO_BANK * allocTotal + lab.designMin;
    const est = Number(c.estimated_minutes || 0);
    const stat = {
      id: c.id,
      title: c.title,
      lessonId: c.lesson || null,
      hasMatchedSection: matched.length > 0,
      lecCjk: attr ? attr.cjk : 0,
      lecEn: attr ? attr.en : 0,
      itemCount: n,
      declaredMinutes: est,
      lectureMinutes: Number(lecMin.toFixed(2)),
      itemDesignMinutes: Number((RHO_BANK * allocTotal).toFixed(2)),
      labMinutes: Number(lab.designMin.toFixed(2)),
      labAnchored: lab.anchored,
      firstPassMinutes: Number(passMin.toFixed(2)),
      designMinutes: Number(designMin.toFixed(2)),
      ratio: est > 0 ? Number((designMin / est).toFixed(2)) : 0,
    };
    checkConceptFindings(stat, unit.id, issues);
    conceptStats.push(stat);
  }

  const declaredSum = conceptStats.reduce((s, c) => s + c.declaredMinutes, 0);
  const unitPass = Object.values(lessonAttrs).reduce((s, l) => s + l.totalReadMin, 0) +
    items.reduce((s, it) => s + calcItemEffort(it).solveMin, 0) +
    conceptStats.reduce((s, c) => s + (c.itemCount === 0 ? calcLabEffort(c.lessonId && lessonAttrs[c.lessonId]?.perConcept[c.id]?.matchedSections || []).minPassMin : 0), 0);
  const unitDesign = conceptStats.reduce((s, c) => s + c.designMinutes, 0) + untaggedDesign;
  return {
    id: unit.id,
    title: unit.title,
    lessonCount: (unit.lessons || []).length,
    conceptCount: concepts.length,
    itemCount: items.length,
    untaggedItems: untaggedItems.length,
    declaredMinutes: declaredSum,
    firstPassMinutes: Number(unitPass.toFixed(2)),
    designMinutes: Number(unitDesign.toFixed(2)),
    ratio: declaredSum > 0 ? Number((unitDesign / declaredSum).toFixed(2)) : 0,
    concepts: conceptStats,
  };
}

/**
 * Audit a course package directory for bottom-up content-to-hours alignment.
 */
export function auditCourseEffort(courseDirRaw, opts = {}) {
  const courseDir = resolve(courseDirRaw);
  const manifestPath = join(courseDir, "course.json");
  if (!existsSync(manifestPath)) {
    return { ok: false, errorCount: 1, warningCount: 0, issues: [{ severity: "error", rule: "MISSING_MANIFEST", target: courseDir, message: "缺少 course.json" }] };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const issues = [];
  const units = (manifest.units || []).map((u) => evaluateUnit(courseDir, u, issues));
  const declaredMinutes = units.reduce((s, u) => s + u.declaredMinutes, 0);
  const firstPassMinutes = Number(units.reduce((s, u) => s + u.firstPassMinutes, 0).toFixed(2));
  const designMinutes = Number(units.reduce((s, u) => s + u.designMinutes, 0).toFixed(2));
  const conceptCount = units.reduce((s, u) => s + u.conceptCount, 0);
  const itemCount = units.reduce((s, u) => s + u.itemCount, 0);
  const untaggedItems = units.reduce((s, u) => s + u.untaggedItems, 0);
  const ratio = declaredMinutes > 0 ? Number((designMinutes / declaredMinutes).toFixed(2)) : 0;

  if (conceptCount > 0 && declaredMinutes > 0 && ratio < 0.5) {
    addFinding(issues, "error", "SEVERE_UNDER_STUFFED_COURSE", manifest.course_id, `课程总内容量严重不足（设计估算 ${designMinutes}m / 声明 ${declaredMinutes}m，η=${ratio}）`);
  } else if (conceptCount > 0 && ratio > 2.5) {
    addFinding(issues, "error", "SEVERE_OVER_STUFFED_COURSE", manifest.course_id, `课程总内容量严重超载（设计估算 ${designMinutes}m / 声明 ${declaredMinutes}m，η=${ratio}）`);
  }
  if (opts.syllabusPath) {
    const syl = JSON.parse(readFileSync(resolve(opts.syllabusPath), "utf8"));
    const sylMin = (syl.lessons || []).reduce((s, l) => s + Number(l.duration_minutes || 0), 0);
    if (sylMin > 0 && declaredMinutes > 0 && (declaredMinutes / sylMin < 0.8 || declaredMinutes / sylMin > 1.25)) {
      addFinding(issues, "error", "SYLLABUS_HOURS_MISMATCH", manifest.course_id, `课程总声明学时 ${declaredMinutes}m 与大纲合计 ${sylMin}m 不匹配`);
    }
  }
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const ok = opts.strict ? errorCount === 0 && warningCount === 0 : errorCount === 0;
  return {
    ok,
    tool: "audit-course-effort",
    courseId: manifest.course_id,
    version: manifest.version,
    protocolVersion: manifest.protocol_version,
    noConceptGraph: conceptCount === 0,
    unitCount: units.length,
    conceptCount,
    itemCount,
    untaggedItems,
    declaredMinutes,
    declaredHours: Number((declaredMinutes / 60).toFixed(2)),
    firstPassMinutes,
    designMinutes,
    designHours: Number((designMinutes / 60).toFixed(2)),
    ratio,
    errorCount,
    warningCount,
    units,
    issues,
  };
}
