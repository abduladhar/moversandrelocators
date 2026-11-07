import { useContext, useEffect, useRef, useState } from 'react'
import { Alert, Button, Input, Popconfirm, Select, Skeleton, Tooltip, message } from 'antd'
import { CopyOutlined, DeleteOutlined, PlusOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons'
import { assistantApi, type AssistantChart, type AssistantConversationSummary, type AssistantMessage, type AssistantStatus } from '../assistantApi'
import { PageHeader } from '../components/PageHeader'
import { AssistantMarkdown } from '../components/assistant/AssistantMarkdown'
import { BarList, ChartCard, ColumnChart, Legend, compact, vizSeries } from '../components/dashboard/DashboardKit'
import { OpenListContext } from '../searchHandoff'
import { formatDate, formatNumber, useT } from '../i18n'

/** Suggested questions, each shown when the user's assistant can read its dataset. */
const SUGGESTIONS: { key: string; dataset: string }[] = [
  { key: 'leadsBySource', dataset: 'leads' }, { key: 'profitByJob', dataset: 'operation_profitability' }, { key: 'overdueFollowUps', dataset: 'follow_ups' },
  { key: 'crewSpend', dataset: 'operation_money' }, { key: 'acceptance', dataset: 'quotations' }, { key: 'owing60', dataset: 'receivables' },
  { key: 'jobsNextWeek', dataset: 'pickups' }, { key: 'unbilled', dataset: 'charges' }, { key: 'surveysThisWeek', dataset: 'surveys' },
  { key: 'lateJobs', dataset: 'packing_jobs' }, { key: 'invoicedCollected', dataset: 'invoices' }, { key: 'topSalesperson', dataset: 'leads' },
]

/**
 * Ask Crateway: managers type any question about the company's data and the AI answers from it. Suggested questions
 * are only shortcuts. Each answer shows how it was worked out (the datasets read), may carry a chart, and links
 * records back to their lists. Conversations are saved per user and company.
 */
export function AssistantPage() {
  const { t, language } = useT()
  const openList = useContext(OpenListContext)
  const [status, setStatus] = useState<AssistantStatus>(), [error, setError] = useState<string>()
  const [list, setList] = useState<AssistantConversationSummary[]>([])
  const [active, setActive] = useState<string | null>(null), [messages, setMessages] = useState<AssistantMessage[]>([])
  const [question, setQuestion] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState<string | null>(null)
  const thread = useRef<HTMLDivElement>(null)

  const refreshList = () => assistantApi.conversations().then(setList).catch(() => undefined)
  useEffect(() => {
    assistantApi.status().then(s => { setStatus(s); setProvider(p => p ?? s.providers[0]?.key ?? null) }).catch(e => setError(e instanceof Error ? e.message : t('assistant.loadFailed')))
    void refreshList()
  }, [])
  useEffect(() => { thread.current?.scrollTo({ top: thread.current.scrollHeight, behavior: 'smooth' }) }, [messages, busy])

  const open = async (id: string) => {
    if (busy) return
    setActive(id); setLoading(true)
    try { setMessages((await assistantApi.conversation(id)).messages) }
    catch (e) { message.error(e instanceof Error ? e.message : t('assistant.loadFailed')) }
    finally { setLoading(false) }
  }
  const startNew = () => { if (!busy) { setActive(null); setMessages([]); setQuestion('') } }
  const remove = async (id: string) => {
    try { await assistantApi.remove(id); if (id === active) startNew(); await refreshList() }
    catch (e) { message.error(e instanceof Error ? e.message : t('assistant.deleteFailed')) }
  }

  const ask = async (text: string) => {
    const q = text.trim()
    if (!q || busy) return
    setBusy(true); setQuestion('')
    const pending: AssistantMessage = { role: 'user', text: q, atUtc: new Date().toISOString(), provider: null, model: null, steps: null, chart: null, cost: null }
    setMessages(m => [...m, pending])
    try {
      const answer = await assistantApi.ask({ conversationId: active, question: q, provider, language })
      setActive(answer.conversationId)
      setMessages(m => [...m.slice(0, -1), answer.question, answer.answer])
      void refreshList()
    } catch (e) {
      // Put the question back so it can be sent again.
      setMessages(m => m.slice(0, -1)); setQuestion(q)
      message.error(e instanceof Error ? e.message : t('assistant.askFailed'))
    } finally { setBusy(false) }
  }

  const providers = status?.providers ?? []
  const suggestions = SUGGESTIONS.filter(s => status?.datasets.includes(s.dataset)).slice(0, 6)
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => message.success(t('assistant.copied'))).catch(() => undefined)

  return <>
    <PageHeader eyebrow={t('shell.nav.sections.workspace')} title={t('assistant.title')} description={t('assistant.description')} />
    {error && <Alert type="error" showIcon title={error} />}
    {!status ? !error && <Skeleton active paragraph={{ rows: 6 }} /> : <div className="assistant">
      <aside className="assistant-history" aria-label={t('assistant.history')}>
        <Button block icon={<PlusOutlined />} onClick={startNew} disabled={busy}>{t('assistant.newChat')}</Button>
        {list.length === 0 ? <p className="assistant-history-empty">{t('assistant.noHistory')}</p> : <ul>
          {list.map(c => <li key={c.id} className={c.id === active ? 'is-active' : undefined}>
            <button type="button" onClick={() => void open(c.id)} disabled={busy}><span>{c.title}</span><small>{formatDate(c.updatedAtUtc, { dateStyle: 'medium' })}</small></button>
            <Popconfirm title={t('assistant.deleteConfirm')} okText={t('common.delete')} okButtonProps={{ danger: true }} onConfirm={() => remove(c.id)}>
              <Button type="text" size="small" icon={<DeleteOutlined />} aria-label={t('common.delete')} />
            </Popconfirm>
          </li>)}
        </ul>}
      </aside>

      <section className="assistant-chat">
        <div className="assistant-thread" ref={thread} aria-live="polite">
          {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : messages.length === 0 ? <div className="assistant-welcome">
            <span className="assistant-welcome-icon"><RobotOutlined /></span>
            <h3>{t('assistant.welcomeTitle')}</h3>
            <p>{t('assistant.welcomeText')}</p>
            {suggestions.length > 0 && <><small>{t('assistant.tryAsking')}</small><div className="assistant-suggestions">
              {suggestions.map(s => <button key={s.key} type="button" disabled={busy || providers.length === 0} onClick={() => void ask(t(`assistant.suggestions.${s.key}`))}>{t(`assistant.suggestions.${s.key}`)}</button>)}
            </div></>}
          </div> : messages.map((m, i) => m.role === 'user'
            ? <div key={i} className="assistant-msg is-user"><div className="assistant-bubble" dir="auto">{m.text}</div></div>
            : <div key={i} className="assistant-msg is-answer">
              <span className="assistant-avatar" aria-hidden><RobotOutlined /></span>
              <div className="assistant-answer">
                <AssistantMarkdown text={m.text} onOpen={openList} />
                {m.chart && <AnswerChart chart={m.chart} />}
                <div className="assistant-meta">
                  {m.steps && m.steps.length > 0 && <details>
                    <summary>{t('assistant.howWorkedOut', { count: m.steps.length })}</summary>
                    <ul>{m.steps.map((s, n) => <li key={n}><strong>{t(`assistant.datasets.${s.dataset}`) === `assistant.datasets.${s.dataset}` ? s.dataset : t(`assistant.datasets.${s.dataset}`)}</strong>
                      {s.summary && <> · <code>{s.summary}</code></>}{s.error ? <span className="assistant-step-error"> · {t('assistant.stepRetried')}</span> : <> · {t('assistant.matched', { count: formatNumber(s.matched) })}</>}</li>)}</ul>
                  </details>}
                  <span>{[m.provider, formatDate(m.atUtc, { timeStyle: 'short' })].filter(Boolean).join(' · ')}</span>
                  <Tooltip title={t('assistant.copy')}><Button type="text" size="small" icon={<CopyOutlined />} aria-label={t('assistant.copy')} onClick={() => copy(m.text)} /></Tooltip>
                </div>
              </div>
            </div>)}
          {busy && <div className="assistant-msg is-answer"><span className="assistant-avatar" aria-hidden><RobotOutlined /></span>
            <div className="assistant-answer is-thinking"><span className="assistant-dots" aria-hidden><i /><i /><i /></span>{t('assistant.thinking')}</div></div>}
        </div>

        {providers.length === 0 ? <Alert type="warning" showIcon title={t('assistant.notConfigured')} description={t('assistant.notConfiguredHint')} />
          : <form className="assistant-composer" onSubmit={e => { e.preventDefault(); void ask(question) }}>
            <Input.TextArea value={question} onChange={e => setQuestion(e.target.value)} maxLength={2000} autoSize={{ minRows: 1, maxRows: 6 }} disabled={busy}
              placeholder={t('assistant.placeholder')} aria-label={t('assistant.placeholder')}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(question) } }} />
            <div className="assistant-composer-actions">
              {providers.length > 1 && <Select size="small" value={provider} onChange={setProvider} aria-label={t('assistant.provider')} popupMatchSelectWidth={false}
                options={providers.map(p => ({ value: p.key, label: `${p.name} · ${p.model}` }))} />}
              <small>{t('assistant.disclaimer')}</small>
              <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={busy} disabled={!question.trim()}>{t('assistant.send')}</Button>
            </div>
          </form>}
      </section>
    </div>}
  </>
}

/** The chart the assistant attached, drawn with the dashboard chart kit, with a table view of the same numbers. */
function AnswerChart({ chart }: { chart: AssistantChart }) {
  const { t } = useT()
  const format = (v: number) => chart.money ? formatNumber(v, { maximumFractionDigits: 2 }) : compact(v)
  const series = chart.series.slice(0, 3).map((s, i) => ({ label: s.name, color: vizSeries[i] }))
  const columns = [{ key: 'label', title: t('assistant.chartLabel') }, ...chart.series.map((s, i) => ({ key: 's' + i, title: s.name, align: 'right' as const }))]
  const rows = chart.labels.map((label, r) => ({ label, ...Object.fromEntries(chart.series.map((s, i) => ['s' + i, format(s.values[r] ?? 0)])) }))
  return <div className="assistant-chart"><ChartCard title={chart.title} columns={columns} rows={rows} legend={series.length > 1 ? <Legend items={series} /> : undefined}>
    {chart.type === 'bar' && chart.series.length === 1
      ? <BarList keepOrder format={format} rows={chart.labels.map((label, i) => ({ label, value: chart.series[0].values[i] ?? 0 }))} />
      : <ColumnChart label={chart.title} format={format} series={series} mode={series.length > 1 ? 'grouped' : 'stacked'}
          points={chart.labels.map((label, i) => ({ label, values: chart.series.slice(0, 3).map(s => s.values[i] ?? 0) }))} />}
  </ChartCard></div>
}

export default AssistantPage
