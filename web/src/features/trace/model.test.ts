import {describe, expect, it} from 'vitest';
import {duration, entriesFrom, officialLink, type TraceEvent} from './model';

function event(id: number, type: TraceEvent['type'], extra: Partial<TraceEvent> = {}): TraceEvent {
  return {id, type, span_id: 'model', parent_id: '', kind: 'llm', label: 'Model',
    status: 'running', origin: 'application', content: '', observed_at_ms: id * 1000, ...extra};
}
describe('observed trace presentation', () => {
  it('preserves partial text and unknown endings without inventing an end timestamp', () => {
    const rows = entriesFrom([event(1, 'start'), event(2, 'delta', {content: '<script>literal</script>'})], false);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.end).toBeUndefined(); expect(rows[0]!.unknownEnd).toBe(true);
    expect(rows[0]!.content).toBe('<script>literal</script>');
  });
  it('keeps real parentage, whole-response attribution and terminal duration', () => {
    const rows = entriesFrom([event(1, 'start'), event(2, 'start', {span_id: 'answer', parent_id: 'model', kind: 'answer'}),
      event(3, 'delta', {span_id: 'answer', content: 'Answer', origin: 'response'}),
      event(4, 'end', {span_id: 'answer', status: 'completed'}), event(5, 'end', {status: 'completed'})], false);
    expect(rows[1]).toMatchObject({depth: 1, batch: true, content: 'Answer', end: 4000});
    expect(duration(rows[0]!.end! - rows[0]!.start)).toBe('4.0s');
    expect(duration(-100)).toBe('0.0s');
  });
  it('only turns safe official source lines into links', () => {
    expect(officialLink('https://www.gov.cn/law')).toBe('https://www.gov.cn/law');
    for (const url of ['javascript:alert(1)', 'https://gov.cn.evil.example/',
      'https://user:secret@www.gov.cn/', 'https://www.gov.cn:8443/']) expect(officialLink(url)).toBeUndefined();
  });
  it('marks completion-only tool results as unmeasured observations', () => {
    const rows = entriesFrom([
      event(1, 'start', {kind: 'tool'}),
      event(2, 'end', {kind: 'tool', status: 'completed', content: '仅收到完成结果；未测得独立执行区间'}),
    ], false);
    expect(rows[0]).toMatchObject({batch: true, status: 'completed'});
  });
});
