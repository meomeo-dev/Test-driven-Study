import Markdown, { type Components } from 'react-markdown';

// Lessons sit below the unit heading (h2), so every Markdown heading moves down
// two levels: `#` → h3, `##` → h4, `###` → h5. Deeper levels stop at h6.
const lessonHeadings: Components = { h1: 'h3', h2: 'h4', h3: 'h5', h4: 'h6', h5: 'h6' };

/**
 * Full-width reading pane for the Markdown lessons of one course unit. The
 * caller keys it by unit so that a newly selected lesson opens at its start.
 */
export function LessonReader({ lessons }: { lessons: string[] }) {
  return <section className="guide-lesson" aria-label="学习内容" tabIndex={0}>
    {lessons.map((text, index) => <div key={index} className="guide-lesson-body">
      <Markdown skipHtml disallowedElements={['img']} components={lessonHeadings}>{text}</Markdown>
    </div>)}
  </section>;
}
