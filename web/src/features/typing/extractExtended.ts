import type {
  Question,
  RichText,
  StudyTranslation,
  SubQuestionReview,
  TranscriptLine,
} from '../../api/generated/types.gen';
import type { HighlightSpan } from './engine';
import {
  alignSentencesWithTranslation,
  configToSpeech,
  detectSentenceLanguage,
  resolveOptionTexts,
  richTextToPlain,
  splitIntoSentences,
  splitParagraphWithOffsets,
  toSpeech,
  type TypingSentence,
} from './sentences';

export function buildClozeSentences(
  question: Extract<Question, { question_type: 'cloze' }>,
  translations?: string[],
  courseLanguage?: string,
): TypingSentence[] {
  const blanks = new Map<number, string>();
  for (const blank of question.question_review?.blanks ?? []) {
    const correct = resolveOptionTexts(blank.options, blank.grading.choice_ids);
    const answerText = correct.map(item => item.text.trim()).filter(Boolean).join(' / ');
    if (answerText) blanks.set(blank.index, answerText);
  }
  const passage = question.question_review?.passage ?? question.content.passage;
  let filled = '';
  const spans: HighlightSpan[] = [];
  const appendBlank = (index: number) => {
    const replacement = blanks.get(index) ?? '___';
    const start = filled.length;
    filled += replacement;
    if (blanks.has(index)) spans.push({ start, end: filled.length });
  };

  if (typeof passage === 'string') {
    let cursor = 0;
    for (const match of passage.matchAll(/\{\{(\d+)\}\}/g)) {
      const matchIndex = match.index ?? 0;
      filled += passage.slice(cursor, matchIndex);
      appendBlank(Number(match[1]));
      cursor = matchIndex + match[0].length;
    }
    filled += passage.slice(cursor);
  } else {
    for (const segment of passage) {
      if (segment.type === 'blank' && segment.index !== undefined) appendBlank(segment.index);
      else filled += segment.text ?? '';
    }
  }

  const sentences: TypingSentence[] = [];
  let paragraphOffset = 0;
  for (const paragraph of filled.split(/\r?\n/)) {
    for (const slice of splitParagraphWithOffsets(paragraph)) {
      const globalStart = paragraphOffset + slice.start;
      const globalEnd = paragraphOffset + slice.end;
      const localSpans = spans
        .filter(span => span.start >= globalStart && span.end <= globalEnd)
        .map(span => ({
          start: Array.from(filled.slice(globalStart, span.start)).length,
          end: Array.from(filled.slice(globalStart, span.end)).length,
        }));
      sentences.push({
        id: `cloze-${sentences.length}`,
        role: 'answer',
        roleLabel: '完形全文（含答案）',
        text: slice.text,
        language: detectSentenceLanguage(slice.text, courseLanguage),
        highlights: localSpans.length ? localSpans : undefined,
      });
    }
    paragraphOffset += paragraph.length + 1;
  }
  if (translations?.length) {
    const hints = alignSentencesWithTranslation(
      sentences.map(item => item.text),
      translations.join('\n'),
      courseLanguage,
    );
    sentences.forEach((item, index) => {
      item.hint = hints[index];
    });
  }
  if (sentences.length === 1 && question.question_review?.passage_tts) {
    sentences[0]!.speech = configToSpeech(sentences[0]!.text, question.question_review.passage_tts);
  }
  return sentences;
}

export function appendPassageSentences(
  target: TypingSentence[],
  passage: RichText | undefined,
  roleLabel: string,
  translations?: string[],
  courseLanguage?: string,
) {
  if (!passage) return;
  if (typeof passage === 'string') {
    const parts = splitIntoSentences(passage);
    const hints = translations?.length === parts.length
      ? translations
      : alignSentencesWithTranslation(parts, translations?.join('\n'), courseLanguage);
    parts.forEach((text, index) => {
      target.push({
        id: `passage-${target.length}`,
        role: 'passage',
        roleLabel,
        text,
        language: detectSentenceLanguage(text, courseLanguage),
        hint: hints[index],
      });
    });
    return;
  }
  let translationIndex = 0;
  for (const segment of passage) {
    if (segment.type === 'blank') continue;
    const raw = segment.text ?? '';
    if (!raw.trim()) continue;
    const hint = translations?.[translationIndex++];
    const parts = splitIntoSentences(raw);
    const hints = alignSentencesWithTranslation(parts, hint, courseLanguage);
    const speech = parts.length === 1
      ? toSpeech(parts[0]!, segment.tts, segment.pinyin, segment.tts_text)
      : undefined;
    parts.forEach((text, partIndex) => {
      target.push({
        id: `passage-${target.length}`,
        role: 'passage',
        roleLabel,
        text,
        language: detectSentenceLanguage(text, courseLanguage),
        hint: hints[partIndex],
        speech: partIndex === 0 ? speech : undefined,
      });
    });
  }
}

export function appendTranscriptSentences(
  target: TypingSentence[],
  lines: TranscriptLine[],
  audioConfig: { voice_male?: 'stella' | 'tide'; voice_female?: 'stella' | 'tide' } | undefined,
  translations?: string[],
  courseLanguage?: string,
) {
  lines.forEach((line, lineIndex) => {
    const speaker = line.speaker?.trim();
    const roleLabel = speaker ? `听力原文 · ${speaker}` : '听力原文';
    const voice = speaker === 'M'
      ? audioConfig?.voice_male
      : speaker === 'W'
        ? audioConfig?.voice_female
        : undefined;
    const lineTts = typeof line.tts === 'object'
      ? { voice, ...line.tts }
      : line.tts === false
        ? undefined
        : voice ? { voice } : true;
    const parts = splitIntoSentences(line.text);
    const hints = alignSentencesWithTranslation(parts, translations?.[lineIndex], courseLanguage);
    const speech = parts.length === 1 ? toSpeech(parts[0]!, lineTts) : undefined;
    parts.forEach((text, partIndex) => {
      target.push({
        id: `transcript-${lineIndex}-${partIndex}`,
        role: 'transcript',
        roleLabel,
        text,
        language: detectSentenceLanguage(text, courseLanguage),
        hint: hints[partIndex],
        speech: partIndex === 0 ? speech : undefined,
      });
    });
  });
}

export function appendSubQuestionSentences(
  target: TypingSentence[],
  subQuestions: SubQuestionReview[] | undefined,
  translations?: StudyTranslation,
  courseLanguage?: string,
) {
  if (!subQuestions?.length) return;
  subQuestions.forEach((sub, index) => {
    const num = index + 1;
    const subTr = translations?.sub_questions?.[sub.id];
    const stemParts = splitIntoSentences(richTextToPlain(sub.stem));
    const stemHints = alignSentencesWithTranslation(stemParts, subTr?.stem, courseLanguage);
    const singleSeg = Array.isArray(sub.stem) && sub.stem.length === 1 ? sub.stem[0] : undefined;
    const stemSpeech = stemParts.length === 1 && singleSeg
      ? toSpeech(stemParts[0]!, singleSeg.tts, singleSeg.pinyin, singleSeg.tts_text)
      : undefined;
    stemParts.forEach((text, partIndex) => {
      target.push({
        id: `sub-${sub.id}-stem-${partIndex}`,
        role: 'sub_question',
        roleLabel: `小题 ${num} 题目`,
        text,
        language: detectSentenceLanguage(text, courseLanguage),
        hint: stemHints[partIndex],
        speech: partIndex === 0 ? stemSpeech : undefined,
      });
    });

    if (sub.type === 'single_choice' || sub.type === 'multiple_choice') {
      resolveOptionTexts(sub.options, sub.grading.choice_ids).forEach((option, optIdx) => {
        const parts = splitIntoSentences(option.text);
        const hints = alignSentencesWithTranslation(
          parts,
          subTr?.options?.[option.id],
          courseLanguage,
        );
        const speech = parts.length === 1 ? toSpeech(parts[0]!, option.tts, option.pinyin) : undefined;
        parts.forEach((text, partIdx) => {
          target.push({
            id: `sub-${sub.id}-ans-${optIdx}-${partIdx}`,
            role: 'answer',
            roleLabel: `小题 ${num} 答案`,
            text,
            language: detectSentenceLanguage(text, courseLanguage),
            hint: hints[partIdx],
            speech: partIdx === 0 ? speech : undefined,
          });
        });
      });
    } else if (sub.type === 'true_false') {
      const boolValue = sub.grading.boolean ?? sub.grading.value === true;
      const opt = sub.options?.find(item => item.value === boolValue);
      const text = opt?.text ?? (boolValue ? '正确' : '错误');
      target.push({
        id: `sub-${sub.id}-ans`,
        role: 'answer',
        roleLabel: `小题 ${num} 答案`,
        text,
        language: detectSentenceLanguage(text, courseLanguage),
        hint: opt?.id ? subTr?.options?.[opt.id] : undefined,
      });
    } else {
      const value = String(sub.grading.value ?? '').trim();
      if (value) {
        target.push({
          id: `sub-${sub.id}-ans`,
          role: 'answer',
          roleLabel: `小题 ${num} 答案`,
          text: value,
          language: detectSentenceLanguage(value, courseLanguage),
        });
      }
    }
  });
}
