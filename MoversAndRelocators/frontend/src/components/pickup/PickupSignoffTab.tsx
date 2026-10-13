import { useRef, useState } from 'react'
import { Button, Card, Empty, Form, Input, Select, Space, Tag, message } from 'antd'
import { CheckCircleOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { pickupsApi } from '../../api'
import type { Employee, PickupDetail, PickupSignoff, PickupWork } from '../../types'
import { SignaturePad, type SignaturePadHandle } from '../SignaturePad'
import { when } from '../TripClockCard'
import { useT } from '../../i18n'

// The statement is shown and stored in the signer's language: pickups.signoff.statement.<party>.
type SignForm = { signerName: string; employeeId?: string; remarks: string }

function SignoffForm({ party, detail, employees, onWork }: { party: 'EMPLOYEE' | 'CUSTOMER'; detail: PickupDetail; employees: Employee[]; onWork: (work: PickupWork) => void }) {
  const [form] = Form.useForm<SignForm>(), pad = useRef<SignaturePadHandle>(null), [busy, setBusy] = useState(false)
  const { t } = useT()
  const statement = t('pickups.signoff.statement.' + party)
  const crew = detail.assignments.map(a => ({ value: a.employeeId, label: `${a.employeeName} · ${a.role}` }))
  const others = employees.filter(e => e.isActive && !detail.assignments.some(a => a.employeeId === e.id)).map(e => ({ value: e.id, label: e.fullName }))
  const lead = detail.assignments.find(a => /lead/i.test(a.role)) ?? detail.assignments[0]
  const sign = async () => {
    const v = await form.validateFields(); const signature = pad.current?.toDataUrl()
    if (!signature) return message.warning(t('pickups.signoff.signFirst'))
    setBusy(true)
    try {
      onWork(await pickupsApi.sign(detail.pickup.id, { party, signerName: v.signerName, employeeId: party === 'EMPLOYEE' ? v.employeeId : null, statement, remarks: v.remarks, signaturePng: signature }))
      pad.current?.clear(); form.setFieldValue('remarks', ''); message.success(party === 'EMPLOYEE' ? t('pickups.signoff.crewRecorded') : t('pickups.signoff.customerRecorded'))
    } catch (e) { message.error(e instanceof Error ? e.message : t('pickups.signoff.recordFailed')) } finally { setBusy(false) }
  }
  return <Card title={<Space>{party === 'EMPLOYEE' ? <SafetyCertificateOutlined /> : <UserOutlined />}{party === 'EMPLOYEE' ? t('pickups.signoff.crewLeadConfirmation') : t('pickups.signoff.customerConfirmation')}</Space>}>
    <Form form={form} layout="vertical" requiredMark={false} initialValues={party === 'EMPLOYEE' ? { employeeId: lead?.employeeId, signerName: lead?.employeeName ?? '', remarks: '' } : { signerName: detail.pickup.customerName, remarks: '' }}>
      {party === 'EMPLOYEE' && <Form.Item label={t('common.employee')} name="employeeId" rules={[{ required: true, message: t('pickups.signoff.selectEmployee') }]}>
        <Select showSearch optionFilterProp="label" options={[{ label: t('pickups.signoff.crewOnPickup'), options: crew }, { label: t('pickups.signoff.otherEmployees'), options: others }]} onChange={(id: string) => form.setFieldValue('signerName', employees.find(e => e.id === id)?.fullName ?? '')} />
      </Form.Item>}
      <Form.Item label={party === 'EMPLOYEE' ? t('common.name') : t('pickups.signoff.customerOrRep')} name="signerName" rules={[{ required: true, whitespace: true, message: t('pickups.signoff.enterFullName') }, { max: 160 }]}><Input /></Form.Item>
      <blockquote className="signoff-statement">{statement}</blockquote>
      <Form.Item label={t('common.remarks')} name="remarks"><Input.TextArea rows={2} maxLength={1000} placeholder={party === 'EMPLOYEE' ? t('pickups.signoff.remarksCrew') : t('pickups.signoff.remarksCustomer')} /></Form.Item>
      <SignaturePad ref={pad} label={party === 'EMPLOYEE' ? t('pickups.signoff.employeeSignature') : t('pickups.customerSignature')} />
      <Button type="primary" block icon={<CheckCircleOutlined />} loading={busy} onClick={() => void sign()} style={{ marginTop: 14 }}>{t('pickups.signoff.confirmAndSign')}</Button>
    </Form>
  </Card>
}

function SignoffRecord({ x }: { x: PickupSignoff }) {
  const { t } = useT()
  return <li className="signoff-record">
    <img src={x.signaturePng} alt={t('pickups.signoff.signatureOf', { name: x.signerName })} />
    <div><Space size={6}><strong>{x.signerName}</strong><Tag color={x.party === 'CUSTOMER' ? 'gold' : 'green'}>{x.party === 'CUSTOMER' ? t('common.customer') : t('common.employee')}</Tag></Space>
      <small>{t('pickups.signoff.signedAt', { date: when(x.signedAtUtc), name: x.recordedBy })}</small>{x.remarks && <p>{x.remarks}</p>}</div>
  </li>
}

type Props = { detail: PickupDetail; work: PickupWork; employees: Employee[]; onWork: (work: PickupWork) => void }

/** On-site confirmation from the crew lead and the customer, each with a drawn signature. Sign-offs are permanent. */
export function PickupSignoffTab({ detail, work, employees, onWork }: Props) {
  const { t } = useT()
  return <div className="pickup-signoffs">
    <div className="pickup-tab-grid">
      {/* Crew only: a pickup is not held up waiting for the customer to sign. Customer sign-offs already
          recorded still show below, and the API still accepts them. */}
      <SignoffForm party="EMPLOYEE" detail={detail} employees={employees} onWork={onWork} />
    </div>
    <Card title={t('pickups.signoff.recorded')} extra={<Tag>{work.signoffs.length}</Tag>}>
      {work.signoffs.length ? <ul className="signoff-records">{[...work.signoffs].reverse().map(x => <SignoffRecord key={x.id} x={x} />)}</ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pickups.signoff.none')} />}
    </Card>
  </div>
}
