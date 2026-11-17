import { useId } from 'react';
import { sizes, type Preferences, type AspectRatio, type Resolution } from './preferences';

export function ImageParameters({value, models, disabled, onChange, size}: {
  value: Preferences; models: string[]; disabled: boolean;
  onChange: (value: Preferences) => void; size?: string;
}) {
  const description = useId();
  function change<K extends keyof Preferences>(key: K, next: Preferences[K]) {
    onChange({...value, [key]: next});
  }
  return <>
    <label>模型<select value={value.model} disabled={disabled}
      onChange={event => change('model', event.target.value)}>
      {!models.includes(value.model) && <option value={value.model}>
        {value.model ? `${value.model} · 当前未配置` : '请选择模型'}</option>}
      {models.map(model => <option key={model}>{model}</option>)}
    </select></label>
    <div className="palace-setting-pair">
      <label>画幅<select value={value.aspect_ratio} disabled={disabled}
        onChange={event => change('aspect_ratio', event.target.value as AspectRatio)}>
        <option value="9:16">9:16 · 竖版</option><option value="2:3">2:3 · 竖版</option>
      </select></label>
      <label>质量<select value={value.quality} disabled={disabled}
        onChange={event => change('quality', event.target.value as Preferences['quality'])}>
        <option value="low">低</option><option value="medium">中</option><option value="high">高</option>
      </select></label>
    </div>
    <label>分辨率<select aria-label="分辨率" aria-describedby={description}
      value={value.resolution} disabled={disabled}
      onChange={event => change('resolution', event.target.value as Resolution)}>
      {(['1k', '2k', '4k'] as const).map(tier => <option key={tier} value={tier}>
        {tier === '4k' && value.aspect_ratio === '2:3' ? '4K档 · 上限约3.5K' : tier.toUpperCase()}
        {' · '}{sizes[value.aspect_ratio][tier].replace('x', '×')}</option>)}
    </select><small id={description} className="muted">实际尺寸 {(size || sizes[value.aspect_ratio][value.resolution]).replace('x', ' × ')}，宽高均为16的倍数。</small></label>
  </>;
}
