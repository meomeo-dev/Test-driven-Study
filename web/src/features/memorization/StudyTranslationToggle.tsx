export type StudyTranslationControl = {
  visible: boolean;
  toggle: () => void;
};

export function StudyTranslationToggle({ control }: { control?: StudyTranslationControl }) {
  if (!control) return null;
  return (
    <button
      type="button"
      className="study-translation-toggle"
      role="switch"
      aria-label="英中对照"
      aria-checked={control.visible}
      onClick={control.toggle}
    >
      {control.visible ? '英中对照' : '仅原文'}
    </button>
  );
}
