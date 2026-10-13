import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Input, Result, Segmented, Space, Tag, Typography, message } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { publicLeadInventoryApi, type PublicInventoryLine, type PublicLeadInventory } from '../api'
import { ItemPicture } from '../components/ItemPicture'

type Answer = { needed: boolean | null; note: string }

/**
 * The expected inventory, opened by the customer through the link their coordinator shared. They cannot change the
 * list, only say what they actually want moved: what they drop here is left out of the volume and of the quotation.
 * Every answer is kept, so they can come back and change their mind until the link expires.
 */
export function CustomerLeadInventoryPage({ token }: { token: string }) {
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
    if (!lines.length) { message.warning('Mark at least one item before sending.'); return }
    setSaving(true)
    try { apply(await publicLeadInventoryApi.review(token, lines)); setSent(true); message.success('Thank you — your answers have been sent to your move coordinator.') }
    catch (error) { message.error(error instanceof Error ? error.message : 'Unable to send your answers') }
    finally { setSaving(false) }
  }

  if (invalid) return <div className="public-upload-page"><Result status="warning" title="Inventory link unavailable" subTitle="This link is invalid, expired or has been revoked. Please contact your move coordinator." /></div>

  const rooms = [...new Set((data?.lines ?? []).map(l => l.room ?? 'Other'))]
  const line = (l: PublicInventoryLine) => {
    const a = answers[l.id] ?? { needed: null, note: '' }
    return <div key={l.id} className={'review-item' + (a.needed === false ? ' is-dropped' : '')}>
      <div className="review-item-main">
        {l.imageUrl ? <ItemPicture src={l.imageUrl} mark={l.imageMark} alt={l.name} size={52} /> : <span className="review-item-nopic" aria-hidden="true" />}
        <div className="review-item-text">
          <strong>{l.name}</strong>
          <small>{l.kind === 'BOX' ? `${l.quantity} box${l.quantity === 1 ? '' : 'es'}` : `Quantity ${l.quantity}`}{l.fragile ? ' · Fragile' : ''}{l.notes ? ` · ${l.notes}` : ''}</small>
        </div>
        <Segmented value={a.needed === null ? '' : a.needed ? 'keep' : 'drop'} onChange={v => set(l.id, { needed: v === 'keep' })}
          options={[{ value: 'keep', label: 'Move it', icon: <CheckCircleOutlined /> }, { value: 'drop', label: 'Not needed', icon: <CloseCircleOutlined /> }]} />
      </div>
      {a.needed === false && <Input size="small" className="review-item-note" maxLength={500} placeholder="Why not? (optional — selling it, staying behind…)" value={a.note} onChange={e => set(l.id, { note: e.target.value })} />}
    </div>
  }

  return <div className="public-upload-page">
    <Card className="public-upload-card" loading={!data}>
      <div className="upload-brand"><span>{(data?.tenantName || 'M').charAt(0).toUpperCase()}</span><strong>{data?.tenantName ?? ''}</strong></div>
      <Typography.Title level={2}>Check your moving list</Typography.Title>
      <Typography.Paragraph type="secondary">
        This is what we have on the list for {data?.customerName}. Mark anything you are not taking with you — we will
        leave it out of your quotation. You can come back and change your answers until this link expires.
      </Typography.Paragraph>
      <Alert showIcon type="info" message={`Reference ${data?.leadNumber ?? ''}`} description={data ? `This secure link expires ${new Date(data.expiresAtUtc).toLocaleString()}.` : ''} />

      {data && !data.lines.length && <Alert style={{ marginTop: 16 }} type="warning" showIcon message="Nothing on the list yet" description="Your move coordinator has not added your items yet. Please check back later." />}

      {data && data.lines.length > 0 && <>
        <div className="review-summary">
          <div><small>Items on the list</small><strong>{data.lines.length}</strong></div>
          <div><small>Answered</small><strong>{answered} of {data.lines.length}</strong></div>
          <div className={dropped ? 'is-dropped' : ''}><small>Not needed</small><strong>{dropped}</strong></div>
        </div>
        {rooms.map(room => <section key={room} className="review-room">
          <h3>{room}</h3>
          {data.lines.filter(l => (l.room ?? 'Other') === room).map(line)}
        </section>)}
        <Space wrap className="review-actions">
          <Button type="primary" size="large" loading={saving} onClick={() => void save()}>Send my answers</Button>
          {sent && <Tag color="green">Sent — thank you</Tag>}
          {answered < data.lines.length && <Typography.Text type="secondary">{data.lines.length - answered} still unanswered; send now and finish later if you prefer.</Typography.Text>}
        </Space>
      </>}
    </Card>
  </div>
}
