import type { PalaceInfo, PalaceSettings as Settings, PalaceJob } from '../../api/palace';
import { active, statusLabel } from '../../api/palace';
import { imagePreferences, sizes } from './preferences';
import { ImageParameters } from './ImageParameters';

export function PalaceSettings({ info, value, onChange, reference, disabled, onPrompt }: {
  info?: PalaceInfo; value: Settings; onChange: (value: Settings) => void;
  reference: boolean; disabled: boolean; onPrompt: () => void;
}) {
  function change<K extends keyof Settings>(key: K, next: Settings[K]) {
    onChange({ ...value, [key]: next });
  }
  return <div className="palace-settings">
    <ImageParameters value={imagePreferences(value)} models={info?.models ?? []}
      disabled={disabled || !info?.ready} size={value.size}
      onChange={next => onChange({...value, ...next, size: sizes[next.aspect_ratio][next.resolution] as Settings['size']})} />
    <label>宫殿地址（可选）<input maxLength={128} value={value.palace_address}
      disabled={disabled} placeholder="例如：交通信号 · 第一层"
      onChange={event => change('palace_address', event.target.value)} /></label>
    <label className="palace-checkbox"><input type="checkbox" checked={value.use_reference}
      disabled={disabled || !reference} onChange={event => change('use_reference', event.target.checked)} />
      使用原题配图作为参考</label>
    {!reference && <p className="dialog-note">本题无可用的 PNG/JPEG 参考图，仍可根据完整题文生成。</p>}
    <button className="button secondary" onClick={onPrompt}>查看完整提示词</button>
    <p className="dialog-note">一次自动生成一张，结果保存在本地。LLM 先构思，生图模型随后接收本题内容
      {value.use_reference ? '和原题配图' : ''}。AI 画面与法规说明需自行核对。</p>
    {info && !info.ready && <p className="palace-error" role="alert">{info.message}</p>}
  </div>;
}

export function PalaceHistory({ jobs, selected, onSelect }: {
  jobs: PalaceJob[]; selected?: string; onSelect: (job: PalaceJob) => void;
}) {
  return <div className="palace-history-list">
    {!jobs.length && <p className="dialog-note">本科目还没有生成记录。</p>}
    {jobs.map(job => <button key={job.id} className={`palace-history-item ${job.id === selected ? 'selected' : ''}`}
      onClick={() => onSelect(job)} aria-pressed={job.id === selected}>
      <span><b>#{job.question_id}</b> <span className={active(job) ? 'palace-busy-label' : ''}>
        {statusLabel[job.status]}</span></span>
      <small>{new Date(job.created_at_ms).toLocaleString('zh-CN', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      })} · {job.snapshot.settings.model}</small>
      {job.snapshot.retry_of && <small>仅生图 · 复用已保存提示词</small>}
    </button>)}
  </div>;
}
