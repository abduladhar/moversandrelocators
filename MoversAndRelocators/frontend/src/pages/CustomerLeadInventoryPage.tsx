import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Input, Result, Segmented, Space, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { publicLeadInventoryApi, type PublicInventoryLine, type PublicLeadInventory } from '../api'
import { ItemPicture } from '../components/ItemPicture'
import { formatDateTime, useT } from '../i18n'

type Answer = { needed: boolean | null; note: string }

/**
 * The expected inventory, opened by the customer through the link their coordinator shared. They cannot change the
 * list, only say what they actually want moved: what they drop here is left out of the volume and of the quotation.
 * Every answer is kept, so they can come back and change their mind until the link expires.
 */
export function CustomerLeadInventoryPage({ token }: { token: string }) {
  const { t } = useT()
  const [data, setData] = useState<PublicLeadInventory>()
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [invalid, setInvalid] = useState(false), [saving, setSaving] = useState(false), [sent, setSent] = useState(false)

  const apply = (inventory: PublicLeadInventory) => {
    setData(inventory)
    setAnswers(Object.fromEntries(inventory.lines.map(l => [l.id, { needed: l.customerStatus === 'PENDING' ? null : l.customerStatus === 'NEEDED', note: l.customerNote ?? '' }])))
  }
  useEffect(() => { publicLeadInventoryApi.get(token).then(apply).catch(() => setInvalid(true)) }, [token])

  const answered = useMemo(() => Object.values(answers).filter(a => a.needed !== null).length, [answers])
  const dropped = useMemo(() => Object.values(answers).filter(a => a.needed === false).length, [answers])
  const set = (id: string, patch: Partial<Answer>) => { setAnswers(all => ({ ...all, [id]: { ...all[id], ...patch } })); setSent(false) }

  const save = async () => {
    const lines = Object.entries(answers).filter(([, a]) => a.needed !== null).map(([lineId, a]) => ({ lineId, needed: a.needed as boolean, note: a.note.trim() || null }))
    if (!lines.length) { message.warning(t('customer.inventory.markOne')); return }
    setSaving(true)
    try { apply(await publicLeadInventoryApi.review(token, lines)); setSent(true); message.success(t('customer.inventory.sentThanks')) }
    catch (error) { message.error(error instanceof Error ? error.message : t('customer.inventory.sendFailed')) }
    finally { setSaving(false) }
  }

  if (invalid) return <div className="public-upload-page"><Result status="warning" title={t('customer.inventory.unavailableTitle')} subTitle={t('customer.shared.linkInvalid')} /></div>

  // Lines without a room are grouped under '' and shown as "Other".
  const rooms = [...new Set((data?.lines ?? []).map(l => l.room ?? ''))]
  const line = (l: PublicInventoryLine) => {
    const a = answers[l.id] ?? { needed: null, note: '' }
    return <div key={l.id} className={'review-item' + (a.needed === false ? ' is-dropped' : '')}>
      <div className="review-item-main">
        {l.imageUrl ? <ItemPicture src={l.imageUrl} mark={l.imageMark} alt={l.name} size={52} /> : <span className="review-item-nopic" aria-hidden="true" />}
        <div className="review-item-text">
          <strong>{l.name}</strong>
          <small>{l.kind === 'BOX' ? t('customer.shared.boxesValue', { count: l.quantity }) : t('customer.shared.quantityValue', { quantity: l.quantity })}{l.fragile ? ` · ${t('customer.shared.fragile')}` : ''}{l.notes ? ` · ${l.notes}` : ''}</small>
        </div>
        <Segmented value={a.needed === null ? '' : a.needed ? 'keep' : 'drop'} onChange={v => set(l.id, { needed: v === 'keep' })}
          options={[{ value: 'keep', label: t('customer.inventory.moveIt'), icon: <CheckCircleOutlined /> }, { value: 'drop', label: t('customer.inventory.notNeeded'), icon: <CloseCircleOutlined /> }]} />
      </div>
      {a.needed === false && <Input size="small" className="review-item-note" maxLength={500} placeholder={t('customer.inventory.whyNot')} value={a.note} onChange={e => set(l.id, { note: e.target.value })} />}
    </div>
  }

  return <div className="public-upload-page">
    <Card className="public-upload-card" loading={!data}>
      <div className="upload-brand"><span>{(data?.tenantName || 'M').charAt(0).toUpperCase()}</span><strong>{data?.tenantName ?? ''}</strong></div>
      <Typography.Title level={2}>{t('customer.inventory.title')}</Typography.Title>
      <Typography.Paragraph type="secondary">{t('customer.inventory.intro', { name: data?.customerName ?? '' })}</Typography.Paragraph>
      <Alert showIcon type="info" message={t('customer.shared.reference', { number: data?.leadNumber ?? '' })} description={data ? t('customer.shared.linkExpires', { date: formatDateTime(data.expiresAtUtc) }) : ''} />

      {data && !data.lines.length && <Alert style={{ marginTop: 16 }} type="warning" showIcon message={t('customer.inventory.emptyTitle')} description={t('customer.inventory.emptyText')} />}

      {data && data.lines.length > 0 && <>
        <div className="review-summary">
          <div><small>{t('customer.inventory.itemsOnList')}</small><strong>{data.lines.length}</strong></div>
          <div><small>{t('customer.inventory.answered')}</small><strong>{t('customer.inventory.answeredOf', { answered, total: data.lines.length })}</strong></div>
          <div className={dropped ? 'is-dropped' : ''}><small>{t('customer.inventory.notNeeded')}</small><strong>{dropped}</strong></div>
        </div>
        {rooms.map(room => <section key={room} className="review-room">
          <h3>{room || t('customer.inventory.otherRoom')}</h3>
          {data.lines.filter(l => (l.room ?? '') === room).map(line)}
        </section>)}
        <Space wrap className="review-actions">
          <Button type="primary" size="large" loading={saving} onClick={() => void save()}>{t('customer.inventory.send')}</Button>
          {sent && <Tag color="green">{t('customer.inventory.sentTag')}</Tag>}
          {answered < data.lines.length && <Typography.Text type="secondary">{t('customer.inventory.unanswered', { count: data.lines.length - answered })}</Typography.Text>}
        </Space>
      </>}
    </Card>
  </div>
}
