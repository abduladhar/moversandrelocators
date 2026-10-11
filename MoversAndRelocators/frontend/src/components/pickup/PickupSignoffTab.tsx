import { useRef, useState } from 'react'
import { Button, Card, Empty, Form, Input, Select, Space, Tag, message } from 'antd'
import { CheckCircleOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { pickupsApi } from '../../api'
import type { Employee, PickupDetail, PickupSignoff, PickupWork } from '../../types'
import { SignaturePad, type SignaturePadHandle } from '../SignaturePad'
import { when } from '../TripClockCard'

const statements = {
  EMPLOYEE: 'I confirm that the items listed were packed, labelled and loaded as recorded, and the materials and expenses shown were used for this pickup.',
  CUSTOMER: 'I confirm that my items were packed and loaded as listed, I have checked the rooms, and the boxes and their contents are correct.',
}
type SignForm = { signerName: string; employeeId?: string; remarks: string }

function SignoffForm({ party, detail, employees, onWork }: { party: 'EMPLOYEE' | 'CUSTOMER'; detail: PickupDetail; employees: Employee[]; onWork: (work: PickupWork) => void }) {
  const [form] = Form.useForm<SignForm>(), pad = useRef<SignaturePadHandle>(null), [busy, setBusy] = useState(false)
  const crew = detail.assignments.map(a => ({ value: a.employeeId, label: `${a.employeeName} · ${a.role}` }))
  const others = employees.filter(e => e.isActive && !detail.assignments.some(a => a.employeeId === e.id)).map(e => ({ value: e.id, label: e.fullName }))
  const lead = detail.assignments.find(a => /lead/i.test(a.role)) ?? detail.assignments[0]
  const sign = async () => {
    const v = await form.validateFields(); const signature = pad.current?.toDataUrl()
    if (!signature) return message.warning('Please sign in the box before confirming.')
    setBusy(true)
    try {
      onWork(await pickupsApi.sign(detail.pickup.id, { party, signerName: v.signerName, employeeId: party === 'EMPLOYEE' ? v.employeeId : null, statement: statements[party], remarks: v.remarks, signaturePng: signature }))
      pad.current?.clear(); form.setFieldValue('remarks', ''); message.success(party === 'EMPLOYEE' ? 'Crew sign-off recorded' : 'Customer sign-off recorded')
    } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to record the sign-off') } finally { setBusy(false) }
  }
  return <Card title={<Space>{party === 'EMPLOYEE' ? <SafetyCertificateOutlined /> : <UserOutlined />}{party === 'EMPLOYEE' ? 'Crew lead confirmation' : 'Customer confirmation'}</Space>}>
    <Form form={form} layout="vertical" requiredMark={false} initialValues={party === 'EMPLOYEE' ? { employeeId: lead?.employeeId, signerName: lead?.employeeName ?? '', remarks: '' } : { signerName: detail.pickup.customerName, remarks: '' }}>
      {party === 'EMPLOYEE' && <Form.Item label="Employee" name="employeeId" rules={[{ required: true, message: 'Select the employee signing' }]}>
        <Select showSearch optionFilterProp="label" options={[{ label: 'Crew on this pickup', options: crew }, { label: 'Other employees', options: others }]} onChange={(id: string) => form.setFieldValue('signerName', employees.find(e => e.id === id)?.fullName ?? '')} />
      </Form.Item>}
      <Form.Item label={party === 'EMPLOYEE' ? 'Name' : 'Customer or authorised representative'} name="signerName" rules={[{ required: true, whitespace: true, message: 'Enter the full name' }, { max: 160 }]}><Input /></Form.Item>
      <blockquote className="signoff-statement">{statements[party]}</blockquote>
      <Form.Item label="Remarks" name="remarks"><Input.TextArea rows={2} maxLength={1000} placeholder={party === 'EMPLOYEE' ? 'Damages noticed, items not packed…' : 'Anything you want noted…'} /></Form.Item>
      <SignaturePad ref={pad} label={party === 'EMPLOYEE' ? 'Employee signature' : 'Customer signature'} />
      <Button type="primary" block icon={<CheckCircleOutlined />} loading={busy} onClick={() => void sign()} style={{ marginTop: 14 }}>Confirm and sign</Button>
    </Form>
  </Card>
}

function SignoffRecord({ x }: { x: PickupSignoff }) {
  return <li className="signoff-record">
    <img src={x.signaturePng} alt={`Signature of ${x.signerName}`} />
    <div><Space size={6}><strong>{x.signerName}</strong><Tag color={x.party === 'CUSTOMER' ? 'gold' : 'green'}>{x.party === 'CUSTOMER' ? 'Customer' : 'Employee'}</Tag></Space>
      <small>Signed {when(x.signedAtUtc)} · recorded by {x.recordedBy}</small>{x.remarks && <p>{x.remarks}</p>}</div>
  </li>
}

type Props = { detail: PickupDetail; work: PickupWork; employees: Employee[]; onWork: (work: PickupWork) => void }

/** On-site confirmation from the crew lead and the customer, each with a drawn signature. Sign-offs are permanent. */
export function PickupSignoffTab({ detail, work, employees, onWork }: Props) {
  return <div className="pickup-signoffs">
    <div className="pickup-tab-grid">
      {/* Crew only: a pickup is not held up waiting for the customer to sign. Customer sign-offs already
          recorded still show below, and the API still accepts them. */}
      <SignoffForm party="EMPLOYEE" detail={detail} employees={employees} onWork={onWork} />
    </div>
    <Card title="Recorded sign-offs" extra={<Tag>{work.signoffs.length}</Tag>}>
      {work.signoffs.length ? <ul className="signoff-records">{[...work.signoffs].reverse().map(x => <SignoffRecord key={x.id} x={x} />)}</ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No sign-offs yet" />}
    </Card>
  </div>
}
