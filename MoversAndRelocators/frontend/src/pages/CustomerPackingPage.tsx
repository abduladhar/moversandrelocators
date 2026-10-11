import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import { useEffect, useState } from 'react'
import { Alert, Button, Checkbox, Form, Input, Radio, Spin, Tag } from 'antd'
import { InboxOutlined, PrinterOutlined } from '@ant-design/icons'
import { shipmentApi, type PublicPacking } from '../shipmentApi'

export function CustomerPackingPage({ token }: { token: string }) {
  const [data, setData] = useState<PublicPacking | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [form] = Form.useForm(), confirmed = Form.useWatch('confirmed', form)
  useEffect(() => { shipmentApi.public(token).then(setData).catch(e => setError(e.message)) }, [token])
  const submit = async (v: { name: string; confirmed: boolean; notes?: string }) => {
    if (!data) return
    setBusy(true)
    try { setData(await shipmentApi.respond(token, { ...v, snapshotHash: data.snapshotHash })); setError('') }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save your response.') }
    finally { setBusy(false) }
  }
  return <main className="packing-document">
    <header className="packing-document-header">
      <div className="packing-document-brand"><span className="packing-document-icon"><InboxOutlined /></span><div><small>CUSTOMER REVIEW & CONFIRMATION</small><h1>Packing list</h1></div></div>
      {data && <div className="packing-document-reference"><span>Pickup reference</span><strong>{data.snapshot.pickupNumber}</strong><Tag color={data.response === 'CONFIRMED' ? 'green' : 'gold'}>{data.response === 'PENDING' ? 'Awaiting your review' : data.response === 'CONFIRMED' ? 'Confirmed' : 'Corrections requested'}</Tag></div>}
    </header>
    <div className="packing-document-body">
      <p className="packing-document-intro">Please review every package, its contents and any items left behind before your goods leave. You can confirm the list or request corrections below.</p>
      {error && <Alert type="error" showIcon message={error} />}
      {!data && !error && <Spin aria-label="Loading packing list" />}
      {data && <>
        <section className="packing-document-section"><h2>Customer & pickup details</h2><dl className="packing-document-facts">
          <div><dt>Customer</dt><dd>{data.snapshot.customerName}</dd></div><div><dt>Packages</dt><dd>{data.snapshot.packages.length}</dd></div>
          <div className="packing-fact-wide"><dt>Pickup address</dt><dd>{data.snapshot.address || 'Not provided'}</dd></div>
          <div><dt>List reference</dt><dd>{data.snapshotHash.slice(0, 12)}</dd></div><div><dt>Link expires</dt><dd>{new Date(data.expiresAtUtc).toLocaleString()}</dd></div>
        </dl></section>
        <section className="packing-document-section"><h2>Package contents</h2>
          {!data.snapshot.packages.length && <p className="packing-section-note">No packages are recorded on this list.</p>}
          {data.snapshot.packages.map((p, index) => <article className="packing-package" key={p.id}>
            <header><div><small>PACKAGE {index + 1}</small><h3>{p.trackingNumber}</h3></div><span>{p.boxTypeName}</span></header>
            <table className="packing-items-table"><caption className="packing-sr-only">Contents of package {p.trackingNumber}</caption><thead><tr><th scope="col">Item description</th><th scope="col" className="packing-quantity">Quantity</th><th scope="col">Remarks</th></tr></thead>
              <tbody>{p.items.length ? p.items.map((i, n) => <tr key={n}><td>{i.itemName}</td><td>{i.quantity}</td><td>{i.notes || '—'}</td></tr>) : <tr><td colSpan={3}>No item details recorded.</td></tr>}</tbody>
            </table>
          </article>)}
        </section>
        <section className="packing-document-section"><h2>Items left behind, excluded or unresolved</h2><p className="packing-section-note packing-preserve-lines">{data.snapshot.leftBehindNotes || 'No details recorded.'}</p></section>
        <section className="packing-document-section"><h2>Customer acknowledgement</h2><div className="packing-acknowledgement">
          {data.response === 'PENDING' ? <>
            <p className="packing-print-pending">Awaiting customer review. No confirmation has been recorded.</p>
            <Form data-report-exclude className="packing-response-form" form={form} layout="vertical" onFinish={submit} disabled={busy}>
              <Form.Item name="name" label="Full name of customer or authorized representative" rules={[{ required: true, whitespace: true, message: 'Enter your full name.' }]}><Input maxLength={160} autoComplete="name" /></Form.Item>
              <Form.Item name="confirmed" label="Is this packing list correct?" rules={[{ required: true, message: 'Confirm the list or request corrections.' }]}><Radio.Group className="packing-response-options" options={[{ value: true, label: 'Yes, I confirm this list' }, { value: false, label: 'No, corrections are needed' }]} /></Form.Item>
              <Form.Item name="notes" label={confirmed === false ? 'Corrections required' : 'Comments (optional)'} rules={confirmed === false ? [{ required: true, whitespace: true, message: 'Describe the corrections needed.' }] : []}><Input.TextArea rows={4} maxLength={2000} showCount /></Form.Item>
              <Form.Item name="authorized" valuePropName="checked" rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error('Please confirm you are authorized to respond.')) }]}><Checkbox>I am the customer or their authorized representative, and I have reviewed the packages, contents and exclusions on this list.</Checkbox></Form.Item>
              <div className="packing-response-footer"><span>Your response is recorded against this exact packing list.</span><Button type="primary" htmlType="submit" loading={busy} size="large">Send my response</Button></div>
            </Form>
          </> : <Alert showIcon type={data.response === 'CONFIRMED' ? 'success' : 'warning'} message={data.response === 'CONFIRMED' ? 'Your confirmation is recorded' : 'Your corrections have been recorded'} description={<><p><strong>{data.responderName}</strong>{data.respondedAtUtc && ` · ${new Date(data.respondedAtUtc).toLocaleString()}`}</p><p className="packing-preserve-lines">{data.responseNotes}</p></>} />}
        </div></section>
        <footer className="packing-document-footer"><span>Packing list · {data.snapshot.pickupNumber} · {data.snapshotHash.slice(0, 12)}</span><ReportPrintButton type="PACKING_LIST" title={data.snapshot.pickupNumber+" packing list"} publicToken={token}/></footer>
      </>}
    </div>
  </main>
}

