import { questionAsset } from '../../api/courses';
import { useState, type Ref } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Expand, ImageOff, X } from 'lucide-react';
import type { Detail } from '../../api/client';

export function QuestionImage({ detail, buttonRef, shortcuts = false }: { detail: Detail; buttonRef?: Ref<HTMLButtonElement>; shortcuts?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!detail.question.image_url) return null;
  if (!detail.image_available || failed) return <div className="missing-image" role="note">
    <ImageOff size={24} /><div>
      <strong>{failed ? '配图加载失败' : '原题配图暂缺'}</strong>
      <p>{failed ? '图片读取失败，请重新加载。' : '本地资源包中暂缺此配图。'}</p>
      {failed && <button type="button" className="inline-action"
        onClick={() => setFailed(false)}>重新加载图片</button>}
    </div>
  </div>;
  const source = questionAsset(detail.question);
  return <Dialog.Root>
    <Dialog.Trigger asChild><button ref={buttonRef} type="button" aria-keyshortcuts={shortcuts ? 'f' : undefined} className="question-image" aria-label="放大题目图片">
      <img src={source} alt="本题原始配图" onError={() => setFailed(true)} />
      <span><Expand size={14} />{shortcuts && <kbd aria-hidden="true">f</kbd>}</span>
    </button></Dialog.Trigger>
    <Dialog.Portal><Dialog.Overlay className="image-overlay" />
      <Dialog.Content className="image-dialog" aria-describedby={undefined}>
        <Dialog.Title className="sr-only">题目配图</Dialog.Title>
        <img src={source} alt="放大的本题原始配图" />
        <Dialog.Close className="dialog-close" aria-label="关闭图片"><X size={22} /></Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
