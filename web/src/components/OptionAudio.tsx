import type { QuestionOption } from '../api/generated/types.gen';
import { AudioControls } from './AudioControls';

export function OptionAudio({ option, allOptionsHaveTts }: {
  option: QuestionOption;
  allOptionsHaveTts: boolean;
}) {
  if (option.pinyin?.length) {
    return <AudioControls text={option.item_title} pinyin={option.pinyin} />;
  }
  if (!allOptionsHaveTts) return null;
  return <AudioControls text={option.tts?.text || option.item_title}
    voice={option.tts?.voice} />;
}
