export const CATEGORIES = new Set([
  "word",
  "word_group",
  "phrase",
  "collocation",
  "idiom",
  "function_phrase",
]);

export const POS_TAGS = new Set([
  "n",
  "v",
  "adj",
  "adv",
  "prep",
  "pron",
  "num",
  "conj",
  "interj",
]);

const ALLOWED_KEYS = new Set([
  "id",
  "unit_id",
  "term",
  "meaning",
  "category",
  "pos",
  "grammar_note",
  "question_ids",
  "term_tts",
  "example",
  "example_translation",
  "example_tts",
]);

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const FILLER_GRAMMAR_RE =
  /^(?:无|没有|暂无|不适用|无需说明|无变化|none|n\/a|-+|—+)$/iu;

const hasText = (v) => typeof v === "string" && /\S/.test(v);

function push(issues, severity, rule, file, id, path, message) {
  issues.push({ severity, rule, file, id, path, message });
}

function auditEntryFields(entry, index, file, unitQuestionMap, issues) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    push(issues, "error", "INVALID_ENTRY", file, `[${index}]`, `[${index}]`, "词条必须是 JSON 对象");
    return;
  }
  const id = hasText(entry.id) ? entry.id : `[${index}]`;
  for (const key of Object.keys(entry)) {
    if (!ALLOWED_KEYS.has(key)) {
      push(issues, "error", "UNKNOWN_KEY", file, id, key, `出现未在 Schema 定义的字段 ${key}`);
    }
  }
  if (!hasText(entry.id) || !SLUG_RE.test(entry.id)) {
    push(issues, "error", "INVALID_ENTRY_ID", file, id, "id", "id 必须是非空 kebab-case slug");
  }
  if (!hasText(entry.unit_id) || !SLUG_RE.test(entry.unit_id)) {
    push(issues, "error", "INVALID_UNIT_ID", file, id, "unit_id", "unit_id 必须是有效的 kebab-case slug");
  } else if (unitQuestionMap && !unitQuestionMap.has(entry.unit_id)) {
    push(issues, "error", "UNKNOWN_UNIT_ID", file, id, "unit_id", `unit_id '${entry.unit_id}' 未在 course.json 声明`);
  }
  if (!hasText(entry.term)) {
    push(issues, "error", "EMPTY_TERM", file, id, "term", "term 必须是非空白字符串");
  }
  if (!hasText(entry.meaning)) {
    push(issues, "error", "EMPTY_MEANING", file, id, "meaning", "meaning 必须是非空白字符串");
  }
  if (!CATEGORIES.has(entry.category)) {
    push(issues, "error", "INVALID_CATEGORY", file, id, "category", `无效分类 '${entry.category}'`);
  }
  auditGrammar(entry, id, file, issues);
  auditExamplesAndRefs(entry, id, file, unitQuestionMap, issues);
}

function auditGrammar(entry, id, file, issues) {
  if (entry.pos !== undefined) {
    if (!POS_TAGS.has(entry.pos)) {
      push(issues, "error", "INVALID_POS", file, id, "pos", `无效词性 '${entry.pos}'`);
    } else if (entry.category && entry.category !== "word") {
      push(
        issues,
        "warning",
        "NON_WORD_WITH_POS",
        file,
        id,
        "pos",
        `分类为 '${entry.category}'，通常应省略 pos 避免与 category 语义重复`,
      );
    }
  } else if (entry.category === "word") {
    push(issues, "warning", "WORD_MISSING_POS", file, id, "pos", "category 为 'word' 时建议标注 pos 词性");
  }

  if (entry.grammar_note === undefined) return;
  if (!hasText(entry.grammar_note)) {
    push(issues, "error", "EMPTY_GRAMMAR_NOTE", file, id, "grammar_note", "grammar_note 不得为空白，不用请直接省略");
    return;
  }
  if ([...entry.grammar_note].length > 120) {
    push(issues, "error", "OVERLONG_GRAMMAR_NOTE", file, id, "grammar_note", "grammar_note 超过 120 字符上限");
  }
  if (FILLER_GRAMMAR_RE.test(entry.grammar_note.trim())) {
    push(issues, "error", "FILLER_GRAMMAR_NOTE", file, id, "grammar_note", "禁止填写“无/不适用”等敷衍占位，不需要请直接省略字段");
  }
}

function auditExamplesAndRefs(entry, id, file, unitQuestionMap, issues) {
  const hasEx = entry.example !== undefined;
  const hasTr = entry.example_translation !== undefined;
  if (hasEx && !hasText(entry.example)) {
    push(issues, "error", "EMPTY_EXAMPLE", file, id, "example", "example 不得为空白");
  }
  if (hasTr && !hasText(entry.example_translation)) {
    push(issues, "error", "EMPTY_EXAMPLE_TRANSLATION", file, id, "example_translation", "example_translation 不得为空白");
  }
  if (hasEx !== hasTr) {
    push(issues, "error", "UNPAIRED_EXAMPLE", file, id, hasEx ? "example_translation" : "example", "example 与 example_translation 必须成对出现");
  }
  if (!hasEx) {
    if (entry.example_tts !== undefined) {
      push(issues, "error", "ORPHAN_EXAMPLE_TTS", file, id, "example_tts", "未提供 example 时不可声明 example_tts");
    }
    push(issues, "warning", "MISSING_EXAMPLE", file, id, "example", "建议为词条配备贴近语境的双语例句");
  }

  if (entry.question_ids === undefined) {
    if (unitQuestionMap) {
      push(issues, "warning", "MISSING_QUESTION_REFS", file, id, "question_ids", "课程模式下建议绑定同单元关联题号 question_ids");
    }
    return;
  }
  if (!Array.isArray(entry.question_ids)) {
    push(issues, "error", "INVALID_QUESTION_IDS", file, id, "question_ids", "question_ids 必须是数组");
    return;
  }
  if (unitQuestionMap && entry.question_ids.length === 0) {
    push(issues, "warning", "MISSING_QUESTION_REFS", file, id, "question_ids", "question_ids 为空，无法在“本题”作用域命中");
  }
  const seen = new Set();
  const unitSet = unitQuestionMap?.get(entry.unit_id);
  for (const qid of entry.question_ids) {
    if (!hasText(qid)) {
      push(issues, "error", "EMPTY_QUESTION_ID", file, id, "question_ids", "question_ids 不可包含空字符串");
      continue;
    }
    if (seen.has(qid)) {
      push(issues, "error", "DUPLICATE_QUESTION_ID", file, id, "question_ids", `question_ids 含重复题号 '${qid}'`);
      continue;
    }
    seen.add(qid);
    if (unitSet && !unitSet.has(qid)) {
      push(issues, "error", "UNKNOWN_QUESTION_ID", file, id, "question_ids", `题号 '${qid}' 不属于单元 '${entry.unit_id}'`);
    }
  }
}

export function auditVocabularyEntries(entries, { file = "vocabulary.json", unitQuestionMap = null } = {}) {
  const issues = [];
  if (!Array.isArray(entries) || entries.length === 0) {
    push(issues, "error", "EMPTY_VOCABULARY", file, null, "$", "词表必须是非空 JSON 数组");
    return { issues, stats: { entries: 0, withPos: 0, withGrammarNote: 0, withExample: 0 } };
  }

  const seenIds = new Set();
  const unitCounts = new Map();
  let withPos = 0;
  let withGrammarNote = 0;
  let withExample = 0;
  let nonWordCount = 0;
  let nonWordWithNote = 0;

  entries.forEach((entry, index) => {
    auditEntryFields(entry, index, file, unitQuestionMap, issues);
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      if (hasText(entry.id)) {
        if (seenIds.has(entry.id)) {
          push(issues, "error", "DUPLICATE_ENTRY_ID", file, entry.id, "id", `词条 id '${entry.id}' 重复`);
        }
        seenIds.add(entry.id);
      }
      if (hasText(entry.unit_id)) {
        unitCounts.set(entry.unit_id, (unitCounts.get(entry.unit_id) ?? 0) + 1);
      }
      if (entry.pos) withPos++;
      if (entry.grammar_note) {
        withGrammarNote++;
        if (entry.category && entry.category !== "word") nonWordWithNote++;
      }
      if (entry.category && entry.category !== "word") nonWordCount++;
      if (hasText(entry.example)) withExample++;
    }
  });

  if (unitQuestionMap) {
    for (const [unitId, qSet] of unitQuestionMap.entries()) {
      if (qSet.size > 0 && !unitCounts.has(unitId)) {
        push(
          issues,
          "warning",
          "UNIT_WITHOUT_VOCABULARY",
          file,
          unitId,
          "unit_id",
          `单元 '${unitId}' 有 ${qSet.size} 道题但尚未覆盖任何生词`,
        );
      }
    }
  }

  if (nonWordCount >= 8 && nonWordWithNote / nonWordCount > 0.85) {
    push(
      issues,
      "warning",
      "OVER_ANNOTATED_GRAMMAR",
      file,
      null,
      "grammar_note",
      `多词词条中 ${nonWordWithNote}/${nonWordCount} 条带语法注释，请检查是否给透明复合词/固定套话强加注解`,
    );
  }

  return {
    issues,
    stats: {
      entries: entries.length,
      withPos,
      withGrammarNote,
      withExample,
    },
  };
}
