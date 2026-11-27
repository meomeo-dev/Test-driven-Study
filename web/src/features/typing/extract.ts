import type { Question } from '../../api/generated/types.gen';
import { assertNever } from '../question-types/shared/contracts';
import { parseAnswerSigns } from '../question-types/shared/format';
import {
  appendPassageSentences,
  appendSubQuestionSentences,
  appendTranscriptSentences,
  buildClozeSentences,
} from './extractExtended';
import {
  configToSpeech,
  detectSentenceLanguage,
  richTextToPlain,
  splitIntoSentences,
  toSpeech,
  type TypingScope,
  type TypingSentence,
} from './sentences';

export {
  detectSentenceLanguage,
  languageBadgeLabel,
  splitIntoSentences,
  type TypingLanguage,
  type TypingScope,
  type TypingSentence,
  type TypingSentenceRole,
  type TypingSpeech,
} from './sentences';

export function extractTypingSentences(
  question: Question,
  courseLanguage?: string,
): TypingSentence[] {
  const sentences: TypingSentence[] = [];
  const rawStem = question.rich_content?.length
    ? richTextToPlain(question.rich_content)
    : question.title;
  splitIntoSentences(rawStem).forEach((text, index) => {
    sentences.push({
      id: `stem-${index}`,
      role: 'stem',
      roleLabel: '题目',
      text,
      language: detectSentenceLanguage(text, courseLanguage),
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
        const speech = parts.length === 1 ? toSpeech(parts[0]!, item.tts, item.pinyin) : undefined;
        parts.forEach((text, partIdx) => {
          sentences.push({
            id: `ans-${item.sign}-${partIdx}`,
            role: 'answer',
            roleLabel: correctItems.length > 1 ? `正确答案 ${idx + 1}/${correctItems.length}` : '正确答案',
            text,
            language: detectSentenceLanguage(text, courseLanguage),
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
      sentences.push(...buildClozeSentences(question, courseLanguage));
      break;
    case 'reading_comprehension': {
      const review = question.question_review;
      appendPassageSentences(
        sentences, review?.passage ?? question.content.passage, '阅读原文',
        review?.study_translation?.material, courseLanguage,
      );
      appendSubQuestionSentences(sentences, review?.sub_questions, review?.study_translation, courseLanguage);
      break;
    }
    case 'listening': {
      const review = question.question_review;
      const audio = review && typeof review.audio === 'object' ? review.audio : undefined;
      const transcript = Array.isArray(review?.transcript) ? review.transcript : question.transcript_lines;
      if (transcript?.length) {
        appendTranscriptSentences(sentences, transcript, audio, review?.study_translation?.material, courseLanguage);
      } else {
        const fallback = typeof review?.transcript === 'string' ? review.transcript : review?.passage;
        appendPassageSentences(sentences, fallback, '听力原文', review?.study_translation?.material, courseLanguage);
      }
      appendSubQuestionSentences(sentences, review?.sub_questions, review?.study_translation, courseLanguage);
      break;
    }
    case 'writing': {
      const sample = question.question_review?.sample_response;
      if (sample) {
        const parts = splitIntoSentences(richTextToPlain(sample));
        const speech = parts.length === 1
          ? configToSpeech(parts[0]!, question.question_review?.sample_response_tts)
          : undefined;
        parts.forEach((text, index) => {
          sentences.push({
            id: `writing-sample-${index}`,
            role: 'answer',
            roleLabel: '参考范文',
            text,
            language: detectSentenceLanguage(text, courseLanguage),
            speech: index === 0 ? speech : undefined,
          });
        });
      }
      break;
    }
    case 'translation': {
      const source = question.content.source_text.trim();
      if (source) {
        const parts = splitIntoSentences(source);
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
            speech: index === 0 ? speech : undefined,
          });
        });
      }
      const ref = question.question_review?.reference_translation?.trim();
      if (ref) {
        const parts = splitIntoSentences(ref);
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
            hint: index === 0 && source ? source : undefined,
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
