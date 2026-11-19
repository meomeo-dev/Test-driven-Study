export { blockedKeyEvent, type ShortcutEvent } from '../../components/keyboardEvent';

export const SHORTCUTS = [
  { action: 'next', keys: ['j', 'ArrowRight'], label: '下一题', group: 'Vim 风格导航', repeat: true },
  { action: 'previous', keys: ['k', 'ArrowLeft'], label: '上一题', group: 'Vim 风格导航', repeat: true },
  { action: 'first', keys: ['gg'], label: '当前列表第一题', group: 'Vim 风格导航', repeat: false },
  { action: 'last', keys: ['G'], label: '当前列表最后一题', group: 'Vim 风格导航', repeat: false },
  { action: 'search', keys: ['/'], label: '聚焦搜索', group: 'Vim 风格导航', repeat: false },
  { action: 'master', keys: ['m'], label: '已记住，并到下一题', group: '应用操作', repeat: false },
  { action: 'review', keys: ['r'], label: '切换待复习标记', group: '应用操作', repeat: false },
  { action: 'clear', keys: ['u'], label: '撤销当前题的学习标记', group: '应用操作', repeat: false },
  { action: 'image', keys: ['f'], label: '放大原图', group: '应用操作', repeat: false },
  { action: 'details', keys: ['v'], label: '查看完整题目', group: '应用操作', repeat: false },
  { action: 'navigation', keys: ['n'], label: '展开题目导航', group: '应用操作', repeat: false },
  { action: 'help', keys: ['?'], label: '快捷键帮助', group: '应用操作', repeat: false },
] as const;
export type ShortcutAction = typeof SHORTCUTS[number]['action'];
export type ShortcutActions = Record<ShortcutAction, () => void>;
export function shortcutCommand(
  key: string, pendingG: boolean,
): ShortcutAction | 'prefix' | undefined {
  if (key === 'g') return pendingG ? 'first' : 'prefix';
  return SHORTCUTS.find(item => item.keys.some(binding => binding === key))?.action;
}
export function keyLabel(key: string) {
  const labels: Record<string, string> = { ArrowRight: '→', ArrowLeft: '←', gg: 'g g' };
  return labels[key] ?? key;
}
