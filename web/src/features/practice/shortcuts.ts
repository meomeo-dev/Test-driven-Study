export const SHORTCUTS = [
  { action: 'next', keys: ['j', 'ArrowRight'], label: '下一题', group: 'Vim 风格导航', repeat: true },
  { action: 'previous', keys: ['k', 'ArrowLeft'], label: '上一题', group: 'Vim 风格导航', repeat: true },
  { action: 'first', keys: ['gg'], label: '当前列表第一题', group: 'Vim 风格导航', repeat: false },
  { action: 'last', keys: ['G'], label: '当前列表最后一题', group: 'Vim 风格导航', repeat: false },
  { action: 'search', keys: ['/'], label: '聚焦搜索', group: 'Vim 风格导航', repeat: false },
  { action: 'choose1', keys: ['1'], label: '选择第 1 项', group: '应用操作', repeat: false },
  { action: 'choose2', keys: ['2'], label: '选择第 2 项', group: '应用操作', repeat: false },
  { action: 'choose3', keys: ['3'], label: '选择第 3 项', group: '应用操作', repeat: false },
  { action: 'choose4', keys: ['4'], label: '选择第 4 项', group: '应用操作', repeat: false },
  { action: 'confirm', keys: ['Enter'], label: '提交答案；作答后进入下一题', group: '应用操作', repeat: false },
  { action: 'retry', keys: ['r'], label: '再答一次，保留之前的记录', group: '应用操作', repeat: false },
  { action: 'image', keys: ['f'], label: '放大原图', group: '应用操作', repeat: false },
  { action: 'details', keys: ['v'], label: '查看完整题目', group: '应用操作', repeat: false },
  { action: 'navigation', keys: ['n'], label: '展开题目导航', group: '应用操作', repeat: false },
  { action: 'help', keys: ['?'], label: '快捷键帮助', group: '应用操作', repeat: false },
] as const;
export type ShortcutAction = typeof SHORTCUTS[number]['action'];
export type ShortcutActions = Record<ShortcutAction, () => void>;
export { blockedKeyEvent, keyLabel } from '../memorization/shortcuts';
export function shortcutCommand(key: string, pendingG: boolean): ShortcutAction | 'prefix' | undefined {
  if (key === 'g') return pendingG ? 'first' : 'prefix';
  return SHORTCUTS.find(item => item.keys.some(binding => binding === key))?.action;
}
