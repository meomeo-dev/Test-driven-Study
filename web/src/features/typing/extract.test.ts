import { describe, expect, it } from 'vitest';
import type { Question } from '../../api/generated/types.gen';
import {
  detectSentenceLanguage,
  extractTypingSentences,
  filterTypingSentences,
  splitIntoSentences,
} from './extract';

const baseQuestion = {
  question_id: 1,
  title: '',
  image_url: '',
  image_type: 0,
  answer: '',
  analysis: '',
  skill: '',
  difficulty: 1,
  tags: '',
  licence_id: 0,
  subject_id: 101,
  chapter_id: 1,
  chapter_name: 'Unit 1',
  sub_chapter_id: 0,
  sub_chapter_name: '',
  course_id: 1,
  course_name: 'Test',
  sort: 1,
  province_id: 0,
  city_id: 0,
};

describe('sentence splitting and language detection', () => {
  it('preserves abbreviations, decimals, and parenthetical glosses while splitting sentences', () => {
    expect(
      splitIntoSentences('The workshop opens at 8 a.m. Visitors must sign in. Mr. Lin arrives at 8 a.m. on Friday.'),
    ).toEqual([
      'The workshop opens at 8 a.m.',
      'Visitors must sign in.',
      'Mr. Lin arrives at 8 a.m. on Friday.',
    ]);

    expect(
      splitIntoSentences('班长巡视工位时对你说：How are you?（你好吗？），你最合适且礼貌的回答是：'),
    ).toEqual(['班长巡视工位时对你说：How are you?（你好吗？），你最合适且礼貌的回答是：']);

    expect(splitIntoSentences('第一句。第二句！第三句？')).toEqual(['第一句。', '第二句！', '第三句？']);
  });

  it('detects English, Chinese, mixed, and neutral sentences accurately', () => {
    expect(detectSentenceLanguage('Good morning.')).toBe('en');
    expect(detectSentenceLanguage('早上好。')).toBe('zh');
    expect(detectSentenceLanguage('请说出 Good morning 的意思。')).toBe('mixed');
    expect(detectSentenceLanguage('15')).toBe('neutral');
  });
});

describe('extractTypingSentences across all 9 question types', () => {
  it('extracts single_choice, multiple_choice, true_false, and numeric', () => {
    const single: Question = {
      ...baseQuestion,
      question_type: 'single_choice',
      title: '早晨遇到同事时，最合适的问候语是：',
      answer: '1',
      items: [
        { sign: 1, item_title: 'Good morning.', tts: { voice: 'stella' } },
        { sign: 2, item_title: 'Good night.' },
      ],
    };
    const singleResult = extractTypingSentences(single);
    expect(singleResult.map(s => [s.role, s.text, s.language])).toEqual([
      ['stem', '早晨遇到同事时，最合适的问候语是：', 'zh'],
      ['answer', 'Good morning.', 'en'],
    ]);
    expect(singleResult[1]?.speech).toEqual({ kind: 'tts', text: 'Good morning.', voice: 'stella', speed: undefined });

    const multi: Question = {
      ...baseQuestion,
      question_type: 'multiple_choice',
      title: '请选择两项告别语。',
      answer: '1,3',
      items: [
        { sign: 1, item_title: 'Goodbye.' },
        { sign: 2, item_title: 'Hello.' },
        { sign: 3, item_title: 'See you.' },
      ],
    };
    expect(extractTypingSentences(multi).map(s => s.text)).toEqual([
      '请选择两项告别语。',
      'Goodbye.',
      'See you.',
    ]);

    const tf: Question = {
      ...baseQuestion,
      question_type: 'true_false',
      title: 'The word equipment is uncountable.',
      answer: '1',
      items: [
        { sign: 1, item_title: '正确', boolean_value: true },
        { sign: 2, item_title: '错误', boolean_value: false },
      ],
    };
    expect(extractTypingSentences(tf).map(s => s.text)).toEqual([
      'The word equipment is uncountable.',
      '正确',
    ]);

    const num: Question = {
      ...baseQuestion,
      question_type: 'numeric',
      title: '一共有多少个零件？',
      answer: '15',
    };
    expect(extractTypingSentences(num).map(s => s.text)).toEqual(['一共有多少个零件？', '15']);
  });

  it('fills cloze blanks with answers and computes highlight spans', () => {
    const cloze: Question = {
      ...baseQuestion,
      question_type: 'cloze',
      title: '阅读提示并填空。',
      content: {
        passage: 'Every worker {{1}} sign the checklist. Do not {{2}} the equipment.',
        blanks: [],
      },
      question_review: {
        id: 'c1',
        type: 'cloze',
        stem: '阅读提示并填空。',
        passage: 'Every worker {{1}} sign the checklist. Do not {{2}} the equipment.',
        blanks: [
          { index: 1, options: [{ id: 'a', text: 'must' }], grading: { choice_ids: ['a'] } },
          { index: 2, options: [{ id: 'b', text: 'start' }], grading: { choice_ids: ['b'] } },
        ],
      },
    };
    const result = extractTypingSentences(cloze);
    expect(result.map(s => s.text)).toEqual([
      '阅读提示并填空。',
      'Every worker must sign the checklist.',
      'Do not start the equipment.',
    ]);
    expect(result[1]?.highlights).toEqual([{ start: 13, end: 17 }]);
    expect(result[2]?.highlights).toEqual([{ start: 7, end: 12 }]);
  });

  it('extracts reading_comprehension and listening with aligned translations', () => {
    const reading: Question = {
      ...baseQuestion,
      question_type: 'reading_comprehension',
      title: '阅读通知。',
      content: { passage: '', sub_questions: [] },
      question_review: {
        id: 'r1',
        type: 'reading_comprehension',
        stem: '阅读通知。',
        passage: [
          { type: 'text', text: 'The workshop opens at 8 a.m.', tts: { voice: 'stella' } },
          { type: 'text', text: ' ' },
          { type: 'text', text: 'Visitors must sign in.' },
        ],
        study_translation: {
          material: ['车间上午八点开放。', '访客必须登记。'],
          sub_questions: { q1: { stem: '访客必须做什么？', options: { a: '登记。' } } },
        },
        sub_questions: [
          {
            id: 'q1',
            type: 'single_choice',
            stem: 'What must visitors do?',
            options: [{ id: 'a', text: 'Sign in.' }],
            grading: { choice_ids: ['a'] },
          },
        ],
      },
    };
    const r = extractTypingSentences(reading);
    expect(r.map(s => [s.text, s.hint])).toEqual([
      ['阅读通知。', undefined],
      ['The workshop opens at 8 a.m.', '车间上午八点开放。'],
      ['Visitors must sign in.', '访客必须登记。'],
      ['What must visitors do?', '访客必须做什么？'],
      ['Sign in.', '登记。'],
    ]);

    const listening: Question = {
      ...baseQuestion,
      question_type: 'listening',
      title: '听对话回答问题。',
      content: { sub_questions: [] },
      question_review: {
        id: 'l1',
        type: 'listening',
        stem: '听对话回答问题。',
        audio: { mode: 'dialogue', voice_male: 'tide', voice_female: 'stella' },
        transcript: [
          { speaker: 'M', text: 'Where are the gloves?' },
          { speaker: 'W', text: 'They are on the shelf.' },
        ],
        study_translation: { material: ['手套在哪里？', '在架子上。'] },
        sub_questions: [
          { id: 'sq1', type: 'true_false', stem: 'Gloves are on the desk.', grading: { value: false } },
        ],
      },
    };
    const l = extractTypingSentences(listening);
    expect(l.map(s => [s.roleLabel, s.text, s.hint])).toEqual([
      ['题目', '听对话回答问题。', undefined],
      ['听力原文 · M', 'Where are the gloves?', '手套在哪里？'],
      ['听力原文 · W', 'They are on the shelf.', '在架子上。'],
      ['小题 1 题目', 'Gloves are on the desk.', undefined],
      ['小题 1 答案', '错误', undefined],
    ]);
  });

  it('extracts writing sample_response and translation source + reference', () => {
    const writing: Question = {
      ...baseQuestion,
      question_type: 'writing',
      title: '写一句通知。',
      content: { subtype: 'sentence_making', requirements: [] },
      question_review: {
        id: 'w1',
        type: 'writing',
        subtype: 'sentence_making',
        stem: '写一句通知。',
        requirements: [],
        sample_response: 'First sentence. Second sentence.',
      },
    };
    expect(extractTypingSentences(writing).map(s => s.text)).toEqual([
      '写一句通知。',
      'First sentence.',
      'Second sentence.',
    ]);

    const translation: Question = {
      ...baseQuestion,
      question_type: 'translation',
      title: '译成中文。',
      content: { direction: 'en_to_zh', source_text: 'Leave the checklist here.' },
      question_review: {
        id: 't1',
        type: 'translation',
        direction: 'en_to_zh',
        stem: '译成中文。',
        source_text: 'Leave the checklist here.',
        reference_translation: '把清单留在这里。',
      },
    };
    const t = extractTypingSentences(translation);
    expect(t.map(s => [s.roleLabel, s.text, s.language, s.hint])).toEqual([
      ['题目', '译成中文。', 'zh', undefined],
      ['翻译原文', 'Leave the checklist here.', 'en', '把清单留在这里。'],
      ['参考译文', '把清单留在这里。', 'zh', 'Leave the checklist here.'],
    ]);
    expect(filterTypingSentences(t, 'english').map(s => s.text)).toEqual(['Leave the checklist here.']);
    expect(filterTypingSentences(t, 'answers').map(s => s.text)).toEqual(['把清单留在这里。']);
  });

  it('pairs multi-sentence listening, choice, cloze, and writing translations and respects display_in', () => {
    const multiSentenceListening: Question = {
      ...baseQuestion,
      question_type: 'listening',
      title: '听对话。',
      content: { sub_questions: [] },
      study_translation: {
        display_in: ['memorize', 'typing'],
        material: ['戴维，早上好。你准备好检查生产线了吗？'],
      },
      question_review: {
        id: 'l2',
        type: 'listening',
        stem: '听对话。',
        audio: { mode: 'dialogue', voice_female: 'stella' },
        transcript: [
          { speaker: 'W', text: 'Good morning, David. Are you ready for the line check?' },
        ],
        sub_questions: [],
      },
    };
    expect(extractTypingSentences(multiSentenceListening).map(s => [s.text, s.hint])).toEqual([
      ['听对话。', undefined],
      ['Good morning, David.', '戴维，早上好。'],
      ['Are you ready for the line check?', '你准备好检查生产线了吗？'],
    ]);

    const choiceWithScope: Question = {
      ...baseQuestion,
      question_type: 'single_choice',
      title: '班长问：How many boxes do you see? 选出正确回答。',
      answer: '2',
      items: [
        { id: 'b', sign: 1, item_title: 'I see thirty boxes.' },
        { id: 'a', sign: 2, item_title: 'I see thirteen boxes.' },
      ],
      study_translation: {
        display_in: ['memorize', 'typing'],
        stem: '你看到几个盒子？',
        options: { a: '我看到 13 个盒子。', b: '我看到 30 个盒子。' },
      },
    };
    expect(extractTypingSentences(choiceWithScope).map(s => [s.text, s.hint])).toEqual([
      ['班长问：How many boxes do you see?', '你看到几个盒子？'],
      ['选出正确回答。', undefined],
      ['I see thirteen boxes.', '我看到 13 个盒子。'],
    ]);

    const hiddenFromTyping: Question = {
      ...choiceWithScope,
      study_translation: {
        display_in: ['memorize'],
        stem: '仅背题可见。',
        options: { a: '仅背题可见。', b: '仅背题可见。' },
      },
    };
    expect(extractTypingSentences(hiddenFromTyping).every(s => s.hint === undefined)).toBe(true);

    const clozeWithMaterial: Question = {
      ...baseQuestion,
      question_type: 'cloze',
      title: '完形填空。',
      content: { passage: 'Every worker {{1}} sign. Do not {{2}} now.', blanks: [] },
      study_translation: {
        material: ['每位工人都必须签字。现在不要启动。'],
      },
      question_review: {
        id: 'c2',
        type: 'cloze',
        stem: '完形填空。',
        passage: 'Every worker {{1}} sign. Do not {{2}} now.',
        blanks: [
          { index: 1, options: [{ id: 'a', text: 'must' }], grading: { choice_ids: ['a'] } },
          { index: 2, options: [{ id: 'b', text: 'start' }], grading: { choice_ids: ['b'] } },
        ],
      },
    };
    expect(extractTypingSentences(clozeWithMaterial).map(s => [s.text, s.hint])).toEqual([
      ['完形填空。', undefined],
      ['Every worker must sign.', '每位工人都必须签字。'],
      ['Do not start now.', '现在不要启动。'],
    ]);

    const writingMultiSeg: Question = {
      ...baseQuestion,
      question_type: 'writing',
      title: '写邮件。',
      content: { subtype: 'short_essay', requirements: [] },
      study_translation: {
        display_in: ['memorize', 'typing'],
        sample_response: ['嗨，米娅，', '送货改到周五。请确认。'],
      },
      question_review: {
        id: 'w2',
        type: 'writing',
        subtype: 'short_essay',
        stem: '写邮件。',
        requirements: [],
        sample_response: [
          { type: 'text', text: 'Hi Mia,' },
          { type: 'text', text: '\n\n' },
          { type: 'text', text: 'The delivery moved to Friday. Please confirm.' },
        ],
      },
    };
    expect(extractTypingSentences(writingMultiSeg).map(s => [s.text, s.hint])).toEqual([
      ['写邮件。', undefined],
      ['Hi Mia,', '嗨，米娅，'],
      ['The delivery moved to Friday.', '送货改到周五。'],
      ['Please confirm.', '请确认。'],
    ]);
  });
});
