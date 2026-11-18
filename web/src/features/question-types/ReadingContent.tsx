import type { RichText } from '../../api/generated/types.gen';
import { RichContent } from '../../components/RichContent';

export function ReadingPassage({ passage }: { passage?: RichText }) {
  if (!passage) return null;
  return <section className="analysis-text" aria-label="阅读材料">
    <RichContent content={passage} />
  </section>;
}
