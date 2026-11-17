export function NumericAnswer({ value, disabled, onChange }: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return <label className="numeric-answer">
    数值答案
    <input inputMode="decimal" autoComplete="off" maxLength={64}
      disabled={disabled} value={value} onChange={event => onChange(event.currentTarget.value)} />
  </label>;
}
