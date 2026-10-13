import { useBusinessMasters } from '../../businessMasters'
import { useMessageTemplate } from '../../messageTemplates'
import { ShareChannels } from '../ShareChannels'
import { crewApi, type Team as CrewTeam } from '../../crewApi'
import { useEffect, useState } from 'react'
import { AutoComplete, Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Tag, Typography, message } from 'antd'
import { CalendarOutlined, CopyOutlined, DeleteOutlined, EnvironmentOutlined, LinkOutlined, PlusOutlined, TeamOutlined, WhatsAppOutlined } from '@ant-design/icons'
import { pickupsApi } from '../../api'
import type { Employee, PickupDetail, PickupStatus, Vehicle } from '../../types'
import { toLocal, when } from '../TripClockCard'
import { useT } from '../../i18n'


type PlanForm = { scheduledAtLocal: string; statusId: string; vehicleId?: string; notes: string }

type Props = { detail: PickupDetail; employees: Employee[]; statuses: PickupStatus[]; vehicles: Vehicle[]; onDetail: (detail: PickupDetail) => void; saveCrew: (assignments: { employeeId: string; role: string }[]) => Promise<void> }

/** Plan the pickup: schedule, vehicle, status, crew with roles, and the customer's schedule confirmation link. */
export function PickupPlanTab({ detail, employees, statuses, vehicles, onDetail, saveCrew }: Props) {
  const { rows: roleMasters, reload: reloadRoles } = useBusinessMasters('crew-role')
  const { message: confirmMessage } = useMessageTemplate('PICKUP_CONFIRM')
  const [teams, setTeams] = useState<CrewTeam[]>([])
  const { t } = useT()
  useEffect(() => { crewApi.teams().then(setTeams).catch(() => setTeams([])) }, [])
  // Assigning a team adds its current members with the role each holds there, keeping anyone already on the crew.
  const assignTeam = async (id: string) => {
    const team = teams.find(x => x.id === id); if (!team) return
    const members = team.members.filter(m => !m.leftAtUtc)
    const kept = detail.assignments.filter(a => !members.some(m => m.employeeId === a.employeeId)).map(a => ({ employeeId: a.employeeId, role: a.role }))
    try { await saveCrew([...kept, ...members.map(m => ({ employeeId: m.employeeId, role: m.role }))]); message.success(t('pickups.plan.teamAssigned', { team: team.name })) }
    catch (e) { message.error(e instanceof Error ? e.message : t('pickups.plan.teamFailed')) }
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
      onDetail(await pickupsApi.get(p.id)); message.success(t('pickups.plan.saved'))
    } catch (e) { message.error(e instanceof Error ? e.message : t('pickups.plan.saveFailed')) } finally { setSaving(false) }
  }
  const addCrew = async () => {
    const v = await crewForm.validateFields()
    if (detail.assignments.some(a => a.employeeId === v.employeeId)) return message.warning(t('pickups.plan.alreadyOnCrew'))
    try { await saveCrew([...detail.assignments.map(a => ({ employeeId: a.employeeId, role: a.role })), v]); setCrewOpen(false); message.success(t('pickups.plan.memberAdded')) }
    catch (e) { message.error(e instanceof Error ? e.message : t('pickups.plan.memberFailed')) }
  }
  const removeCrew = async (employeeId: string) => { try { await saveCrew(detail.assignments.filter(a => a.employeeId !== employeeId).map(a => ({ employeeId: a.employeeId, role: a.role }))) } catch (e) { message.error(e instanceof Error ? e.message : t('pickups.plan.crewFailed')) } }
  const share = async () => { try { setLink((await pickupsApi.link(p.id)).url) } catch (e) { message.error(e instanceof Error ? e.message : t('pickups.linkFailed')) } }

  return <div className="pickup-tab-grid">
    <Card title={<Space><CalendarOutlined />{t('pickups.plan.scheduleVehicle')}</Space>} extra={<Button type="primary" loading={saving} onClick={() => void savePlan()}>{t('pickups.plan.savePlan')}</Button>}>
      <Form form={form} layout="vertical" requiredMark={false}>
        <div className="master-form-grid">
          <Form.Item label={t('pickups.pickupDateTime')} name="scheduledAtLocal" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item>
          <Form.Item label={t('common.status')} name="statusId" rules={[{ required: true }]}><Select options={statuses.filter(x => x.isActive || x.id === p.statusId).map(x => ({ value: x.id, label: x.name }))} /></Form.Item>
        </div>
        <Form.Item label={t('pickups.vehicle')} name="vehicleId" extra={vehicle ? `${vehicle.type} · ${vehicle.capacityCbm} m³${vehicle.driverName ? ` · ${t('pickups.plan.driver', { name: vehicle.driverName })}${vehicle.driverPhone ? ` (${vehicle.driverPhone})` : ''}` : ''}` : undefined}>
          <Select allowClear showSearch optionFilterProp="label" placeholder={t('pickups.plan.assignVehicle')} options={vehicles.filter(x => x.isActive || x.id === p.vehicleId).map(x => ({ value: x.id, label: `${x.registrationNumber} · ${x.name} · ${x.capacityCbm} m³` }))} />
        </Form.Item>
        <Form.Item label={t('pickups.crewInstructions')} name="notes"><Input.TextArea rows={3} maxLength={2000} placeholder={t('pickups.plan.notesPlaceholder')} /></Form.Item>
      </Form>
    </Card>

    <div className="pickup-stack">
      <Card title={<Space><TeamOutlined />{t('pickups.crew')}</Space>} extra={<Space wrap><Select<string> style={{ minWidth: 210 }} placeholder={t('pickups.assignTeam')} value={undefined} disabled={!teams.length} onChange={v => void assignTeam(v)} options={teams.filter(x => x.isActive && x.currentMembers > 0).map(x => ({ value: x.id, label: `${x.name} · ${t('pickups.memberCount', { count: x.currentMembers })}` }))} /><Button icon={<PlusOutlined />} onClick={() => { void reloadRoles(); crewForm.resetFields(); crewForm.setFieldsValue({ role: roleMasters.find(x => x.isActive && x.code === (detail.assignments.length ? 'PACKER' : 'LEAD'))?.name ?? crewRoles[0] }); setCrewOpen(true) }}>{t('pickups.plan.assignEmployee')}</Button></Space>}>
        {detail.assignments.length ? <ul className="pickup-list">{detail.assignments.map(a => <li key={a.employeeId}>
          <span className="pickup-avatar">{a.employeeName.charAt(0)}</span><div><strong>{a.employeeName}</strong><small>{a.role}</small></div>
          <Popconfirm title={t('pickups.plan.removeFromCrew')} okText={t('common.remove')} cancelText={t('common.cancel')} onConfirm={() => void removeCrew(a.employeeId)}><Button type="text" size="small" danger aria-label={t('pickups.removeNamed', { name: a.employeeName })} icon={<DeleteOutlined />} /></Popconfirm>
        </li>)}</ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pickups.plan.noCrew')} />}
      </Card>
      {/* A pickup does not wait on the customer, so there is no confirmation link here. The public page and its
          endpoints still exist, so any link already sent keeps working. */}
      <Card title={<Space><EnvironmentOutlined />{t('pickups.plan.location')}</Space>}>
        <div className="pickup-confirmation"><Typography.Text type="secondary">{p.address}</Typography.Text></div>
        <Button icon={<EnvironmentOutlined />} onClick={() => window.open(p.latitude && p.longitude ? `https://www.google.com/maps?q=${p.latitude},${p.longitude}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}`, '_blank', 'noopener')}>{t('pickups.openInMaps')}</Button>
      </Card>
    </div>

    <Modal centered open={crewOpen} title={t('pickups.plan.assignEmployee')} okText={t('pickups.plan.addToCrew')} cancelText={t('common.cancel')} onOk={() => void addCrew()} onCancel={() => setCrewOpen(false)} destroyOnHidden>
      <Form form={crewForm} layout="vertical" requiredMark={false}>
        <Form.Item label={t('common.employee')} name="employeeId" rules={[{ required: true, message: t('pickups.plan.selectEmployee') }]}><Select showSearch optionFilterProp="label" options={employees.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.fullName} · ${x.designationName}` }))} /></Form.Item>
        <Form.Item label={t('pickups.plan.roleOnPickup')} name="role" rules={[{ required: true, whitespace: true, message: t('pickups.plan.enterRole') }]}><Select showSearch optionFilterProp="label" options={crewRoles.map(value => ({ value, label: value }))} /></Form.Item>
      </Form>
    </Modal>
    <Modal centered open={Boolean(link)} title={t('pickups.plan.shareTitle')} footer={null} onCancel={() => setLink(undefined)}>
      <Input.TextArea value={link} readOnly autoSize={{ minRows: 2, maxRows: 3 }} />
      <ShareChannels url={link ?? ''} phone={p.phone} email={p.email} subject={t('pickups.plan.shareSubject', { number: p.pickupNumber })}
        text={confirmMessage({ customer: p.customerName, reference: p.pickupNumber, link })} />
    </Modal>
  </div>
}


