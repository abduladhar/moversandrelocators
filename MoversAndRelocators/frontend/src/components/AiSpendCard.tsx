import { Alert, Card, Empty, Tag, Tooltip } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import type { AiSpend } from '../types'

/** Four decimals: a single extraction often costs a fraction of a cent, and rounding it to 2 would read as free. */
export const aiMoney = (amount: number) => amount.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })

/**
 * What Claude or OpenAI cost on the sales lead behind this survey or quotation. It is kept apart from the staff
 * expenses on purpose: nobody paid this out of pocket and nobody is reimbursed for it, so folding it into the
 * out-of-pocket total would distort what the company owes its people.
 */
export function AiSpendCard({ spend, context }: { spend: AiSpend | null | undefined; context: 'survey' | 'quotation' }) {
  if (!spend || !spend.runs) return null
  const priced = spend.lines.filter(x => x.cost !== null)
  return <Card className="ai-spend-card" title={<span><RobotOutlined /> AI cost carried from the sales lead</span>}
    extra={spend.cost === null ? <Tag>Not priced</Tag> : <strong>{spend.currency} {aiMoney(spend.cost)}</strong>}>
    {spend.cost === null
      ? <Alert type="info" showIcon title="These runs were not priced" description="No AI prices were set in Settings when they ran, so only the usage was recorded. Prices entered later do not rewrite history." />
      : priced.length < spend.lines.length && <Alert style={{ marginBottom: 10 }} type="warning" showIcon title={`${spend.lines.length - priced.length} of ${spend.lines.length} runs are not priced`} description="They ran before AI prices were set in Settings, so they are not in the total." />}
    <div className="ai-spend-list">
      {spend.lines.map(line => <div key={line.id} className="ai-spend-row">
        <Tag color={line.provider === 'Claude' ? 'purple' : 'green'}>{line.provider}</Tag>
        <div className="ai-spend-what"><strong>{line.feature}</strong><small><Tooltip title={`Run by ${line.createdBy}`}>{line.model}</Tooltip> · {new Date(line.incurredAtUtc).toLocaleString()}</small></div>
        <span className="ai-spend-amount">{line.cost === null ? '—' : `${line.currency} ${aiMoney(line.cost)}`}</span>
      </div>)}
      {!spend.lines.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No AI runs on this lead" />}
    </div>
    <p className="ai-spend-note">Spent while this was still a sales lead, before the {context} existed. Shown here so the cost of winning the job is not lost; it is reported, not re-charged.</p>
  </Card>
}
