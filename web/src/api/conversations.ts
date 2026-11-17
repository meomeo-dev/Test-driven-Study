import { request } from './client';
import type { ConversationCoverage, ConversationPage, ConversationRecord } from './generated/types.gen';
export type { ConversationPage, ConversationRecord, ConversationSummary,
  SavedChatMessage } from './generated/types.gen';

const root = '/api/llm/conversations';
export const conversation = (id: string) => request<ConversationRecord>(`${root}/${id}`);
export const createConversation = (questionID: number, id: string = crypto.randomUUID()) =>
  request<ConversationRecord>(root, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, question_id: questionID }),
  });
export function conversations(questionID = 0, before = '', signal?: AbortSignal, course = '') {
  const params = new URLSearchParams({ question_id: String(questionID) });
  if (before) params.set('before', before);
  if (course) params.set('course', course);
  return request<ConversationPage>(`${root}?${params}`, { signal });
}

export function rememberConversation(questionID: number, id: string) {
  try { localStorage.setItem(`assistant-conversation-${questionID}`, id); }
  catch { /* The server remains authoritative when browser storage is unavailable. */ }
}

export async function restoreConversation(questionID: number, newID: string) {
  let selected = '';
  try { selected = localStorage.getItem(`assistant-conversation-${questionID}`) ?? ''; }
  catch { /* Fall back to the latest server conversation. */ }
  const page = await conversations(questionID);
  if (selected) {
    const record = await conversation(selected).catch(() => undefined);
    if (record?.question_id === questionID) return record;
  }
  const latest = page.items[0];
  const record = latest ? await conversation(latest.id) : await createConversation(questionID, newID);
  rememberConversation(questionID, record.id);
  return record;
}

export const conversationCoverage = (subject: number, signal?: AbortSignal) =>
  request<ConversationCoverage[]>(
    `${root}/coverage?subject=${subject}`, { signal });
