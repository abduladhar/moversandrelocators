import { Alert, Card, Empty, Tag, Tooltip } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import type { AiSpend } from '../types'
import { formatDateTime, formatNumber, useT } from '../i18n'

/** Four decimals: a single extraction often costs a fraction of a cent, and rounding it to 2 would read as free. */
export const aiMoney = (amount: number) => formatNumber(amount, { minimumFractionDigits: 4, maximumFractionDigits: 4 })

/**
 * What Claude or OpenAI cost on the sales lead behind this survey or quotation. It is kept apart from the staff
 * expenses on purpose: nobody paid this out of pocket and nobody is reimbursed for it, so folding it into the
 * out-of-pocket total would distort what the company owes its people.
 */
export function AiSpendCard({ spend, context }: { spend: AiSpend | null | undefined; context: 'survey' | 'quotation' }) {
  const { t } = useT()
  if (!spend || !spend.runs) return null
  const priced = spend.lines.filter(x => x.cost !== null)
  return <Card className="ai-spend-card" title={<span><RobotOutlined /> {t('sales.aiSpend.title')}</span>}
    extra={spend.cost === null ? <Tag>{t('sales.aiSpend.notPriced')}</Tag> : <strong>{spend.currency} {aiMoney(spend.cost)}</strong>}>
    {spend.cost === null
      ? <Alert type="info" showIcon title={t('sales.aiSpend.runsNotPriced')} description={t('sales.aiSpend.runsNotPricedDescription')} />
      : priced.length < spend.lines.length && <Alert style={{ marginBottom: 10 }} type="warning" showIcon title={t('sales.aiSpend.someNotPriced', { unpriced: spend.lines.length - priced.length, count: spend.lines.length })} description={t('sales.aiSpend.someNotPricedDescription')} />}
    <div className="ai-spend-list">
      {spend.lines.map(line => <div key={line.id} className="ai-spend-row">
        <Tag color={line.provider === 'Claude' ? 'purple' : 'green'}>{line.provider}</Tag>
        <div className="ai-spend-what"><strong>{line.feature}</strong><small><Tooltip title={t('sales.aiSpend.runBy', { user: line.createdBy })}>{line.model}</Tooltip> · {formatDateTime(line.incurredAtUtc)}</small></div>
        <span className="ai-spend-amount">{line.cost === null ? '—' : `${line.currency} ${aiMoney(line.cost)}`}</span>
      </div>)}
      {!spend.lines.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('sales.aiSpend.noRuns')} />}
    </div>
    <p className="ai-spend-note">{context === 'survey' ? t('sales.aiSpend.noteSurvey') : t('sales.aiSpend.noteQuotation')}</p>
  </Card>
}
