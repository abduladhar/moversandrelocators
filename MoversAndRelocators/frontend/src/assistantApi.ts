import { request } from './api'

/** Ask Crateway: the management assistant (api/assistant). Answers only use data the user's permissions allow. */
export type AssistantStep = { dataset: string; summary: string; matched: number; error: string | null }
export type AssistantChart = { type: 'column' | 'bar'; title: string; labels: string[]; series: { name: string; values: number[] }[]; money: boolean }
export type AssistantMessage = { role: 'user' | 'assistant'; text: string; atUtc: string; provider: string | null; model: string | null; steps: AssistantStep[] | null; chart: AssistantChart | null; cost: number | null }
export type AssistantConversationSummary = { id: string; title: string; createdAtUtc: string; updatedAtUtc: string }
export type AssistantConversation = AssistantConversationSummary & { messages: AssistantMessage[] }
export type AssistantStatus = { providers: { key: string; name: string; model: string }[]; datasets: string[] }
export type AssistantAnswer = { conversationId: string; title: string; question: AssistantMessage; answer: AssistantMessage }

export const assistantApi = {
  status: () => request<AssistantStatus>('/api/assistant/status'),
  conversations: () => request<AssistantConversationSummary[]>('/api/assistant/conversations'),
  conversation: (id: string) => request<AssistantConversation>(`/api/assistant/conversations/${id}`),
  remove: (id: string) => request<void>(`/api/assistant/conversations/${id}`, { method: 'DELETE' }),
  ask: (input: { conversationId: string | null; question: string; provider: string | null; language: string }) =>
    request<AssistantAnswer>('/api/assistant/ask', { method: 'POST', body: JSON.stringify({ ...input, timezoneOffsetMinutes: new Date().getTimezoneOffset() }) }),
}
