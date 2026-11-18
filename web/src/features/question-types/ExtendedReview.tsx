import type { CourseItemReview, ExtendedResponse } from '../../api/generated/types.gen';
import { RichContent } from '../../components/RichContent';
import { creditLabel } from './model';
import { TranslationReference } from './TranslationContent';
import { WritingCriteria, WritingReview, WritingSample } from './WritingContent';

function subAnswer(item: CourseItemReview, value: boolean | string | string[] | undefined) {
  if (typeof value === 'boolean') {
    return item.options?.find(o => o.value === value)?.text ?? (value ? '正确' : '错误');
  }
  if (Array.isArray(value)) return item.options?.filter(o => value.includes(o.id))
    .map(o => o.text).join('、') || '未作答';
  return value ?? '未作答';
}

export function ExtendedReview({ item, response, credit, hideExplanations }: {
  item: CourseItemReview;
  response?: ExtendedResponse;
  credit?: number;
  hideExplanations?: boolean;
}) {
  if (item.type === 'writing') return <>
    <WritingReview response={response} credit={credit} />
    <WritingSample review={item} />
    <WritingCriteria review={item} />
  </>;
  const translation = item.type === 'translation';
  return <section className="extended-review" aria-label="作答反馈">
    {credit !== undefined && <p role="status">
      {translation ? '本地检查得分' : '本题得分比例'}：{creditLabel(credit)}
    </p>}
    {item.blanks?.map(({ index, options, grading, explanation }) => <div key={index}>
      <strong>空格 {index} · {options.find(o => grading.choice_ids?.includes(o.id))?.text}</strong>
      {response && <p>你的答案：{options.find(o => response.blanks?.[index]?.includes(o.id))?.text ?? '未作答'}</p>}
      {!hideExplanations && explanation && <p><RichContent content={explanation} /></p>}
    </div>)}
    {item.sub_questions?.map((sub, index) => <div key={sub.id}>
      <strong>小题 {index + 1} · {subAnswer(sub,
        sub.grading?.choice_ids ?? sub.grading?.boolean ?? sub.grading?.value)}</strong>
      {response && <p>你的答案：{subAnswer(sub, response.sub_answers?.[sub.id])}</p>}
      {!hideExplanations && (sub.analysis || sub.explanation) && <p>
        <RichContent content={sub.analysis ?? sub.explanation} />
      </p>}
    </div>)}
    {translation && <>
      {response?.translation && <p className="extended-passage">你的译文：{response.translation}</p>}
      <TranslationReference review={item} />
      {credit !== undefined && <p className="muted">本地得分依据词数、关键词或参考译文，
        可结合范文和评分细则检查表达。</p>}
    </>}
  </section>;
}
