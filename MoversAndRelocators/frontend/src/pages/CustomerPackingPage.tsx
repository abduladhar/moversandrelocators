import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, Radio, Spin, Tag } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { shipmentApi, type PublicPacking } from '../shipmentApi'
import { formatDateTime, useT } from '../i18n'

export function CustomerPackingPage({ token }: { token: string }) {
  const { t } = useT()
  const [data, setData] = useState<PublicPacking | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [form] = Form.useForm(), confirmed = Form.useWatch('confirmed', form)
  useEffect(() => { shipmentApi.public(token).then(setData).catch(e => setError(e.message)) }, [token])
  const submit = async (v: { name: string; confirmed: boolean; notes?: string }) => {
    if (!data) return
    setBusy(true)
    try { setData(await shipmentApi.respond(token, { ...v, snapshotHash: data.snapshotHash })); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : t('customer.packing.saveFailed')) }
    finally { setBusy(false) }
  }
  return <main className="packing-document">
    <header className="packing-document-header">
      <div className="packing-document-brand"><span className="packing-document-icon"><InboxOutlined /></span><div><small>{t('customer.packing.eyebrow')}</small><h1>{t('customer.packing.title')}</h1></div></div>
      {data && <div className="packing-document-reference"><span>{t('customer.packing.pickupReference')}</span><strong>{data.snapshot.pickupNumber}</strong><Tag color={data.response === 'CONFIRMED' ? 'green' : 'gold'}>{data.response === 'PENDING' ? t('customer.packing.awaitingReview') : data.response === 'CONFIRMED' ? t('customer.packing.confirmed') : t('customer.packing.correctionsRequested')}</Tag></div>}
    </header>
    <div className="packing-document-body">
      <p className="packing-document-intro">{t('customer.packing.intro')}</p>
      {error && <Alert type="error" showIcon message={error} />}
      {!data && !error && <Spin aria-label={t('customer.packing.loading')} />}
      {data && <>
        <section className="packing-document-section"><h2>{t('customer.packing.detailsTitle')}</h2><dl className="packing-document-facts">
          <div><dt>{t('common.customer')}</dt><dd>{data.snapshot.customerName}</dd></div><div><dt>{t('customer.packing.packages')}</dt><dd>{data.snapshot.packages.length}</dd></div>
          <div className="packing-fact-wide"><dt>{t('customer.packing.pickupAddress')}</dt><dd>{data.snapshot.address || t('customer.packing.notProvided')}</dd></div>
          <div><dt>{t('customer.packing.listReference')}</dt><dd>{data.snapshotHash.slice(0, 12)}</dd></div><div><dt>{t('customer.packing.linkExpires')}</dt><dd>{formatDateTime(data.expiresAtUtc)}</dd></div>
        </dl></section>
        <section className="packing-document-section"><h2>{t('customer.packing.contentsTitle')}</h2>
          {!data.snapshot.packages.length && <p className="packing-section-note">{t('customer.packing.noPackages')}</p>}
          {data.snapshot.packages.map((p, index) => <article className="packing-package" key={p.id}>
            <header><div><small>{t('customer.packing.packageNo', { number: index + 1 })}</small><h3>{p.trackingNumber}</h3></div><span>{p.boxTypeName}</span></header>
            <table className="packing-items-table"><caption className="packing-sr-only">{t('customer.packing.contentsCaption', { number: p.trackingNumber })}</caption><thead><tr><th scope="col">{t('customer.packing.itemDescription')}</th><th scope="col" className="packing-quantity">{t('common.quantity')}</th><th scope="col">{t('common.remarks')}</th></tr></thead>
              <tbody>{p.items.length ? p.items.map((i, n) => <tr key={n}><td>{i.itemName}</td><td>{i.quantity}</td><td>{i.notes || '—'}</td></tr>) : <tr><td colSpan={3}>{t('customer.packing.noItemDetails')}</td></tr>}</tbody>
            </table>
          </article>)}
        </section>
        <section className="packing-document-section"><h2>{t('customer.packing.leftBehindTitle')}</h2><p className="packing-section-note packing-preserve-lines">{data.snapshot.leftBehindNotes || t('customer.packing.noDetails')}</p></section>
        <section className="packing-document-section"><h2>{t('customer.packing.acknowledgementTitle')}</h2><div className="packing-acknowledgement">
          {data.response === 'PENDING' ? <>
            <p className="packing-print-pending">{t('customer.packing.pending')}</p>
            <Form data-report-exclude className="packing-response-form" form={form} layout="vertical" onFinish={submit} disabled={busy}>
              <Form.Item name="name" label={t('customer.packing.nameLabel')} rules={[{ required: true, whitespace: true, message: t('customer.packing.nameRequired') }]}><Input maxLength={160} autoComplete="name" /></Form.Item>
              <Form.Item name="confirmed" label={t('customer.packing.correctQuestion')} rules={[{ required: true, message: t('customer.packing.correctRequired') }]}><Radio.Group className="packing-response-options" options={[{ value: true, label: t('customer.packing.yesConfirm') }, { value: false, label: t('customer.packing.noCorrections') }]} /></Form.Item>
              <Form.Item name="notes" label={confirmed === false ? t('customer.packing.correctionsLabel') : t('customer.packing.commentsOptional')} rules={confirmed === false ? [{ required: true, whitespace: true, message: t('customer.packing.correctionsRequired') }] : []}><Input.TextArea rows={4} maxLength={2000} showCount /></Form.Item>
              <Form.Item name="authorized" valuePropName="checked" rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error(t('customer.packing.authorizeRequired'))) }]}><Checkbox>{t('customer.packing.authorizeText')}</Checkbox></Form.Item>
              <div className="packing-response-footer"><span>{t('customer.packing.recordedNote')}</span><Button type="primary" htmlType="submit" loading={busy} size="large">{t('customer.packing.send')}</Button></div>
            </Form>
          </> : <Alert showIcon type={data.response === 'CONFIRMED' ? 'success' : 'warning'} message={data.response === 'CONFIRMED' ? t('customer.packing.confirmationRecorded') : t('customer.packing.correctionsRecorded')} description={<><p><strong>{data.responderName}</strong>{data.respondedAtUtc && ` · ${formatDateTime(data.respondedAtUtc)}`}</p><p className="packing-preserve-lines">{data.responseNotes}</p></>} />}
        </div></section>
        <footer className="packing-document-footer"><span>{t('customer.packing.footer', { pickup: data.snapshot.pickupNumber, reference: data.snapshotHash.slice(0, 12) })}</span><ReportPrintButton type="PACKING_LIST" title={t('customer.packing.printTitle', { number: data.snapshot.pickupNumber })} label={t('customer.packing.print')} publicToken={token}/></footer>
      </>}
    </div>
  </main>
}
