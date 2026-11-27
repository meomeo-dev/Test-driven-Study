import type { Question, RichText, TtsConfig } from '../../api/generated/types.gen';
import { assertNever, parseAnswerSigns, visibleStudyTranslation } from '../question-types';
import {
  appendPassageSentences,
  appendSubQuestionSentences,
  appendTranscriptSentences,
  buildClozeSentences,
} from './extractExtended';
import {
  alignSentencesWithTranslation,
  configToSpeech,
  detectSentenceLanguage,
  richTextToPlain,
  splitIntoSentences,
  toSpeech,
  type TypingScope,
  type TypingSentence,
} from './sentences';

export {
  alignSentencesWithTranslation,
  detectSentenceLanguage,
  languageBadgeLabel,
  splitIntoSentences,
  type TypingLanguage,
  type TypingScope,
  type TypingSentence,
  type TypingSentenceRole,
  type TypingSpeech,
} from './sentences';

function appendWritingSampleSentences(
  target: TypingSentence[],
  sample: RichText | undefined,
  sampleTts: TtsConfig | undefined,
  translations?: string[],
  courseLanguage?: string,
) {
  if (!sample) return;
  if (typeof sample === 'string') {
    const parts = splitIntoSentences(sample);
    const hints = alignSentencesWithTranslation(parts, translations?.join('\n'), courseLanguage);
    const speech = parts.length === 1 ? configToSpeech(parts[0]!, sampleTts) : undefined;
    parts.forEach((text, index) => {
      target.push({
        id: `writing-sample-${index}`,
        role: 'answer',
        roleLabel: '参考范文',
        text,
        language: detectSentenceLanguage(text, courseLanguage),
        hint: hints[index],
        speech: index === 0 ? speech : undefined,
      });
    });
    return;
  }
  let translationIndex = 0;
  for (const segment of sample) {
    if (segment.type === 'blank') continue;
    const raw = segment.text ?? '';
    if (!raw.trim()) continue;
    const parts = splitIntoSentences(raw);
    const hints = alignSentencesWithTranslation(
      parts,
      translations?.[translationIndex++],
      courseLanguage,
    );
    const speech = parts.length === 1
      ? toSpeech(parts[0]!, segment.tts, segment.pinyin, segment.tts_text)
      : undefined;
    parts.forEach((text, partIndex) => {
      target.push({
        id: `writing-sample-${target.length}`,
        role: 'answer',
        roleLabel: '参考范文',
        text,
        language: detectSentenceLanguage(text, courseLanguage),
        hint: hints[partIndex],
        speech: partIndex === 0 ? speech : undefined,
      });
    });
  }
}

export function extractTypingSentences(
  question: Question,
  courseLanguage?: string,
): TypingSentence[] {
  const sentences: TypingSentence[] = [];
  const tr = visibleStudyTranslation(question, 'typing');
  const rawStem = question.rich_content?.length
    ? richTextToPlain(question.rich_content)
    : question.title;
  const stemParts = splitIntoSentences(rawStem);
  const stemHints = alignSentencesWithTranslation(stemParts, tr?.stem, courseLanguage);
  stemParts.forEach((text, index) => {
    sentences.push({
      id: `stem-${index}`,
      role: 'stem',
      roleLabel: '题目',
      text,
      language: detectSentenceLanguage(text, courseLanguage),
      hint: stemHints[index],
    });
  });

  switch (question.question_type) {
    case 'single_choice':
    case 'multiple_choice':
    case 'true_false': {
      const signs = new Set(parseAnswerSigns(question.answer));
      const correctItems = question.items.filter(item => signs.has(item.sign));
      correctItems.forEach((item, idx) => {
        const parts = splitIntoSentences(item.item_title);
        const optTranslation = item.id ? tr?.options?.[item.id] : undefined;
        const hints = alignSentencesWithTranslation(parts, optTranslation, courseLanguage);
        const speech = parts.length === 1 ? toSpeech(parts[0]!, item.tts, item.pinyin) : undefined;
        parts.forEach((text, partIdx) => {
          sentences.push({
            id: `ans-${item.sign}-${partIdx}`,
            role: 'answer',
            roleLabel: correctItems.length > 1 ? `正确答案 ${idx + 1}/${correctItems.length}` : '正确答案',
            text,
            language: detectSentenceLanguage(text, courseLanguage),
            hint: hints[partIdx],
            speech: partIdx === 0 ? speech : undefined,
          });
        });
      });
      break;
    }
    case 'numeric': {
      const value = question.answer.trim();
      if (value) {
        sentences.push({
          id: 'ans-numeric',
          role: 'answer',
          roleLabel: '正确答案',
          text: value,
          language: detectSentenceLanguage(value, courseLanguage),
        });
      }
      break;
    }
    case 'cloze':
      sentences.push(...buildClozeSentences(question, tr?.material, courseLanguage));
      break;
    case 'reading_comprehension': {
      const review = question.question_review;
      appendPassageSentences(
        sentences, review?.passage ?? question.content.passage, '阅读原文',
        tr?.material, courseLanguage,
      );
      appendSubQuestionSentences(sentences, review?.sub_questions, tr, courseLanguage);
      break;
    }
    case 'listening': {
      const review = question.question_review;
      const audio = review && typeof review.audio === 'object' ? review.audio : undefined;
      const transcript = Array.isArray(review?.transcript) ? review.transcript : question.transcript_lines;
      if (transcript?.length) {
        appendTranscriptSentences(sentences, transcript, audio, tr?.material, courseLanguage);
      } else {
        const fallback = typeof review?.transcript === 'string' ? review.transcript : review?.passage;
        appendPassageSentences(sentences, fallback, '听力原文', tr?.material, courseLanguage);
      }
      appendSubQuestionSentences(sentences, review?.sub_questions, tr, courseLanguage);
      break;
    }
    case 'writing': {
      appendWritingSampleSentences(
        sentences,
        question.question_review?.sample_response,
        question.question_review?.sample_response_tts,
        tr?.sample_response,
        courseLanguage,
      );
      break;
    }
    case 'translation': {
      const source = question.content.source_text.trim();
      const ref = question.question_review?.reference_translation?.trim();
      if (source) {
        const parts = splitIntoSentences(source);
        const hints = question.content.direction === 'en_to_zh'
          ? alignSentencesWithTranslation(parts, ref, courseLanguage)
          : parts.map(() => undefined);
        const speech = parts.length === 1
          ? configToSpeech(parts[0]!, question.content.source_text_tts)
          : undefined;
        parts.forEach((text, index) => {
          sentences.push({
            id: `translation-src-${index}`,
            role: 'stem',
            roleLabel: '翻译原文',
            text,
            language: detectSentenceLanguage(text, courseLanguage),
            hint: hints[index],
            speech: index === 0 ? speech : undefined,
          });
        });
      }
      if (ref) {
        const parts = splitIntoSentences(ref);
        const hints = alignSentencesWithTranslation(parts, source, courseLanguage);
        const speech = parts.length === 1
          ? configToSpeech(parts[0]!, question.question_review?.reference_translation_tts)
          : undefined;
        parts.forEach((text, index) => {
          sentences.push({
            id: `translation-ref-${index}`,
            role: 'answer',
            roleLabel: '参考译文',
            text,
            language: detectSentenceLanguage(text, courseLanguage),
            hint: hints[index],
            speech: index === 0 ? speech : undefined,
          });
        });
      }
      break;
    }
    default:
      assertNever(question);
  }
  return sentences;
}

export function filterTypingSentences(
  sentences: TypingSentence[],
  scope: TypingScope,
): TypingSentence[] {
  if (scope === 'english') {
    const englishOnly = sentences.filter(item => item.language === 'en');
    return englishOnly.length ? englishOnly : sentences;
  }
  if (scope === 'answers') {
    const answersOnly = sentences.filter(item => item.role === 'answer');
    return answersOnly.length ? answersOnly : sentences;
  }
  return sentences;
}
