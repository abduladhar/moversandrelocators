import { useBusinessMasters } from '../../businessMasters'
import { crewApi, type Team as CrewTeam } from '../../crewApi'
import { useEffect, useState } from 'react'
import { AutoComplete, Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Tag, Typography, message } from 'antd'
import { CalendarOutlined, CopyOutlined, DeleteOutlined, EnvironmentOutlined, LinkOutlined, PlusOutlined, TeamOutlined, WhatsAppOutlined } from '@ant-design/icons'
import { pickupsApi } from '../../api'
import type { Employee, PickupDetail, PickupStatus, Vehicle } from '../../types'
import { toLocal, when } from '../TripClockCard'


type PlanForm = { scheduledAtLocal: string; statusId: string; vehicleId?: string; notes: string }

type Props = { detail: PickupDetail; employees: Employee[]; statuses: PickupStatus[]; vehicles: Vehicle[]; onDetail: (detail: PickupDetail) => void; saveCrew: (assignments: { employeeId: string; role: string }[]) => Promise<void> }

/** Plan the pickup: schedule, vehicle, status, crew with roles, and the customer's schedule confirmation link. */
export function PickupPlanTab({ detail, employees, statuses, vehicles, onDetail, saveCrew }: Props) {
  const { rows: roleMasters, reload: reloadRoles } = useBusinessMasters('crew-role')
  const [teams, setTeams] = useState<CrewTeam[]>([])
  useEffect(() => { crewApi.teams().then(setTeams).catch(() => setTeams([])) }, [])
  // Assigning a team adds its current members with the role each holds there, keeping anyone already on the crew.
  const assignTeam = async (id: string) => {
    const team = teams.find(t => t.id === id); if (!team) return
    const members = team.members.filter(m => !m.leftAtUtc)
    const kept = detail.assignments.filter(a => !members.some(m => m.employeeId === a.employeeId)).map(a => ({ employeeId: a.employeeId, role: a.role }))
    try { await saveCrew([...kept, ...members.map(m => ({ employeeId: m.employeeId, role: m.role }))]); message.success(`${team.name} assigned`) }
    catch (e) { message.error(e instanceof Error ? e.message : 'Could not assign the team') }
  }
  const crewRoles = roleMasters.filter(x => x.isActive).map(x => x.name)
  const p = detail.pickup
  const [form] = Form.useForm<PlanForm>(), [crewForm] = Form.useForm<{ employeeId: string; role: string }>()
  const [saving, setSaving] = useState(false), [crewOpen, setCrewOpen] = useState(false), [link, setLink] = useState<string>()
  useEffect(() => { form.setFieldsValue({ scheduledAtLocal: toLocal(p.scheduledAtUtc), statusId: p.statusId, vehicleId: p.vehicleId ?? undefined, notes: p.notes ?? '' }) }, [p, form])
  const vehicle = vehicles.find(v => v.id === p.vehicleId)

  const savePlan = async () => {
    const v = await form.validateFields(); setSaving(true)
    try {
      await pickupsApi.update(p.id, { pickupNumber: p.pickupNumber, quotationId: p.quotationId, salesLeadId: p.salesLeadId, customerName: p.customerName, phone: p.phone, email: p.email, address: p.address, scheduledAtUtc: new Date(v.scheduledAtLocal).toISOString(), statusId: v.statusId, vehicleId: v.vehicleId ?? null, notes: v.notes })
      onDetail(await pickupsApi.get(p.id)); message.success('Pickup plan saved')
    } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to save the plan') } finally { setSaving(false) }
  }
  const addCrew = async () => {
    const v = await crewForm.validateFields()
    if (detail.assignments.some(a => a.employeeId === v.employeeId)) return message.warning('This employee is already on the crew.')
    try { await saveCrew([...detail.assignments.map(a => ({ employeeId: a.employeeId, role: a.role })), v]); setCrewOpen(false); message.success('Crew member added') }
    catch (e) { message.error(e instanceof Error ? e.message : 'Unable to add crew member') }
  }
  const removeCrew = async (employeeId: string) => { try { await saveCrew(detail.assignments.filter(a => a.employeeId !== employeeId).map(a => ({ employeeId: a.employeeId, role: a.role }))) } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to update crew') } }
  const share = async () => { try { setLink((await pickupsApi.link(p.id)).url) } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to create the link') } }

  return <div className="pickup-tab-grid">
    <Card title={<Space><CalendarOutlined />Schedule &amp; vehicle</Space>} extra={<Button type="primary" loading={saving} onClick={() => void savePlan()}>Save plan</Button>}>
      <Form form={form} layout="vertical" requiredMark={false}>
        <div className="master-form-grid">
          <Form.Item label="Pickup date and time" name="scheduledAtLocal" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item>
          <Form.Item label="Status" name="statusId" rules={[{ required: true }]}><Select options={statuses.filter(x => x.isActive || x.id === p.statusId).map(x => ({ value: x.id, label: x.name }))} /></Form.Item>
        </div>
        <Form.Item label="Vehicle" name="vehicleId" extra={vehicle ? `${vehicle.type} · ${vehicle.capacityCbm} CBM${vehicle.driverName ? ` · Driver ${vehicle.driverName}${vehicle.driverPhone ? ` (${vehicle.driverPhone})` : ''}` : ''}` : undefined}>
          <Select allowClear showSearch optionFilterProp="label" placeholder="Assign a vehicle" options={vehicles.filter(x => x.isActive || x.id === p.vehicleId).map(x => ({ value: x.id, label: `${x.registrationNumber} · ${x.name} · ${x.capacityCbm} CBM` }))} />
        </Form.Item>
        <Form.Item label="Instructions for the crew" name="notes"><Input.TextArea rows={3} maxLength={2000} placeholder="Access, parking, items needing dismantling…" /></Form.Item>
      </Form>
    </Card>

    <div className="pickup-stack">
      <Card title={<Space><TeamOutlined />Crew</Space>} extra={<Space wrap><Select<string> style={{ minWidth: 210 }} placeholder="Assign a team" value={undefined} disabled={!teams.length} onChange={v => void assignTeam(v)} options={teams.filter(t => t.isActive && t.currentMembers > 0).map(t => ({ value: t.id, label: `${t.name} · ${t.currentMembers} member${t.currentMembers === 1 ? '' : 's'}` }))} /><Button icon={<PlusOutlined />} onClick={() => { void reloadRoles(); crewForm.resetFields(); crewForm.setFieldsValue({ role: roleMasters.find(x => x.isActive && x.code === (detail.assignments.length ? 'PACKER' : 'LEAD'))?.name ?? crewRoles[0] }); setCrewOpen(true) }}>Assign employee</Button></Space>}>
        {detail.assignments.length ? <ul className="pickup-list">{detail.assignments.map(a => <li key={a.employeeId}>
          <span className="pickup-avatar">{a.employeeName.charAt(0)}</span><div><strong>{a.employeeName}</strong><small>{a.role}</small></div>
          <Popconfirm title="Remove from the crew?" onConfirm={() => void removeCrew(a.employeeId)}><Button type="text" size="small" danger aria-label={`Remove ${a.employeeName}`} icon={<DeleteOutlined />} /></Popconfirm>
        </li>)}</ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No crew assigned yet" />}
      </Card>
      {/* A pickup does not wait on the customer, so there is no confirmation link here. The public page and its
          endpoints still exist, so any link already sent keeps working. */}
      <Card title={<Space><EnvironmentOutlined />Location</Space>}>
        <div className="pickup-confirmation"><Typography.Text type="secondary">{p.address}</Typography.Text></div>
        <Button icon={<EnvironmentOutlined />} onClick={() => window.open(p.latitude && p.longitude ? `https://www.google.com/maps?q=${p.latitude},${p.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`, '_blank', 'noopener')}>Open in Maps</Button>
      </Card>
    </div>

    <Modal centered open={crewOpen} title="Assign employee" okText="Add to crew" onOk={() => void addCrew()} onCancel={() => setCrewOpen(false)} destroyOnHidden>
      <Form form={crewForm} layout="vertical" requiredMark={false}>
        <Form.Item label="Employee" name="employeeId" rules={[{ required: true, message: 'Select an employee' }]}><Select showSearch optionFilterProp="label" options={employees.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.fullName} · ${x.designationName}` }))} /></Form.Item>
        <Form.Item label="Role on this pickup" name="role" rules={[{ required: true, whitespace: true, message: 'Enter a role' }]}><Select showSearch optionFilterProp="label" options={crewRoles.map(value => ({ value, label: value }))} /></Form.Item>
      </Form>
    </Modal>
    <Modal centered open={Boolean(link)} title="Share pickup confirmation" footer={null} onCancel={() => setLink(undefined)}>
      <Input.TextArea value={link} readOnly autoSize={{ minRows: 2, maxRows: 3 }} />
      <div className="survey-share-actions" style={{ marginTop: 14 }}>
        <Button className="share-whatsapp" icon={<WhatsAppOutlined />} onClick={() => window.open(`https://wa.me/${p.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Please confirm your pickup ${p.pickupNumber}: ${link}`)}`, '_blank', 'noopener')}>WhatsApp</Button>
        <Button icon={<CopyOutlined />} onClick={() => { void navigator.clipboard.writeText(link ?? ''); message.success('Link copied') }}>Copy link</Button>
      </div>
    </Modal>
  </div>
}


