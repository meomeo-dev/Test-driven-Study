import { questionAsset } from '../../api/courses';
import { useState } from 'react';
import type { ExamItem } from '../../api/exams';

export function TerminalImage({ item }: { item: ExamItem }) {
  const [failed, setFailed] = useState(false);
  const q = item.detail.question;
  if (!q.image_url) return null;
  if (!item.detail.image_available || failed) return <p className="terminal-image-error" role="alert">
    配图读取失败。<button onClick={() => setFailed(false)}>重新加载图片</button>
  </p>;
  return <img src={questionAsset(q)}
    alt="本题原始配图" onError={() => setFailed(true)}/>;
}
