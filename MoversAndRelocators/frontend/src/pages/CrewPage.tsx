import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, SwapOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader'
import { employeesApi } from '../api'
import { crewApi, type CrewOverview, type SaveTeam, type Team, type TeamKind, type TeamMember } from '../crewApi'
import type { Employee } from '../types'
import { useBusinessMasters } from '../businessMasters'

const KIND: Record<TeamKind, { label: string; color: string }> = {
  PACKING: { label: 'Packing', color: 'blue' },
  PICKUP: { label: 'Pickup', color: 'geekblue' },
  BOTH: { label: 'Packing & pickup', color: 'purple' },
}
const when = (x: string | null) => (x ? new Date(x).toLocaleDateString() : '—')

/** Crew management: teams, who is in them over time, and what each team and person is on record for. */
export function CrewPage() {
  // Roles come from the crew-role business master, the same list the pickup and packing crew pickers use.
  const { rows: roleMasters } = useBusinessMasters('crew-role')
  const roles = useMemo(() => roleMasters.filter(r => r.isActive).map(r => r.name), [roleMasters])
  const [teams, setTeams] = useState<Team[]>([]), [employees, setEmployees] = useState<Employee[]>([])
  const [overview, setOverview] = useState<CrewOverview>()
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [showInactive, setShowInactive] = useState(false)
  const [selectedId, setSelectedId] = useState<string>()
  const [teamOpen, setTeamOpen] = useState(false), [editing, setEditing] = useState<Team>()
  const [memberOpen, setMemberOpen] = useState(false), [moving, setMoving] = useState<TeamMember>()
  const [teamForm] = Form.useForm<SaveTeam>(), [memberForm] = Form.useForm<{ employeeId: string; role: string }>()
  const [moveForm] = Form.useForm<{ toTeamId: string; role?: string; reason?: string }>()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, e, p] = await Promise.all([crewApi.teams(showInactive), employeesApi.employees(), crewApi.performance()])
      setTeams(t); setEmployees(e); setOverview(p)
      setSelectedId(current => (current && t.some(x => x.id === current) ? current : t[0]?.id))
    } catch (err) { message.error(err instanceof Error ? err.message : 'Could not load crew') }
    finally { setLoading(false) }
  }, [showInactive])
  useEffect(() => { void load() }, [load])

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try { await action(); message.success(done); await load() }
    catch (err) { message.error(err instanceof Error ? err.message : 'That did not work') }
    finally { setBusy(false) }
  }

  const selected = useMemo(() => teams.find(t => t.id === selectedId), [teams, selectedId])
  const current = selected?.members.filter(m => !m.leftAtUtc) ?? []
  const past = selected?.members.filter(m => m.leftAtUtc) ?? []
  const assignable = employees.filter(e => e.isActive && !current.some(m => m.employeeId === e.id))

  const openTeam = (team?: Team) => {
    setEditing(team)
    teamForm.resetFields()
    if (team) teamForm.setFieldsValue({ code: team.code, name: team.name, kind: team.kind, supervisorEmployeeId: team.supervisorEmployeeId ?? undefined, notes: team.notes ?? undefined })
    else teamForm.setFieldsValue({ kind: 'BOTH' } as SaveTeam)
    setTeamOpen(true)
  }

  // Demo employees are a development aid; production builds do not offer them (the API refuses them outside Development).
  const canSeedDemo = import.meta.env.DEV
  const seed = () => run(
    () => crewApi.seedDemo().then(r => { if (!r.created) throw new Error('Every demo employee already exists.') }),
    'Demo employees created')

  const teamsCard = <Card size="small" title={`Teams (${teams.length})`} extra={<Space wrap>
    {canSeedDemo && <Button size="small" loading={busy} onClick={seed}>Add demo employees</Button>}
    <Button size="small" onClick={() => setShowInactive(v => !v)}>{showInactive ? 'Hide inactive' : 'Show inactive'}</Button>
    <Button size="small" type="primary" icon={<TeamOutlined />} onClick={() => openTeam()}>New team</Button>
  </Space>}>
    {teams.length === 0
      ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No teams yet">
        {canSeedDemo && <Button type="primary" loading={busy} onClick={seed}>Create demo employees and teams</Button>}
      </Empty>
      : <Table<Team> rowKey="id" size="small" pagination={false} dataSource={teams}
        rowClassName={t => (t.id === selectedId ? 'ant-table-row-selected' : '')}
        onRow={t => ({ onClick: () => setSelectedId(t.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Team', render: (_, t) => <Space direction="vertical" size={0}><b>{t.name}</b>
            <Typography.Text type="secondary">{t.code}{t.supervisorName ? ` · supervised by ${t.supervisorName}` : ' · no supervisor'}</Typography.Text></Space> },
          { title: 'Does', width: 150, render: (_, t) => <Tag color={KIND[t.kind].color}>{KIND[t.kind].label}</Tag> },
          { title: 'Members', width: 100, render: (_, t) => t.currentMembers },
          { title: '', width: 90, render: (_, t) => <Space size={4}>
            <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={e => { e.stopPropagation(); openTeam(t) }} /></Tooltip>
            <Tooltip title={t.isActive ? 'Deactivate' : 'Reactivate'}>
              <Button size="small" danger={t.isActive} disabled={busy}
                onClick={e => { e.stopPropagation(); void run(() => crewApi.setActive(t.id, !t.isActive), t.isActive ? 'Team deactivated' : 'Team reactivated') }}>
                {t.isActive ? 'Off' : 'On'}
              </Button></Tooltip>
          </Space> },
        ]} />}
  </Card>

  const membersCard = selected && <Card size="small" title={`${selected.name} · members`} extra={
    <Button size="small" type="primary" icon={<UserAddOutlined />} disabled={busy || !assignable.length}
      onClick={() => { memberForm.resetFields(); memberForm.setFieldValue('role', roles[0]); setMemberOpen(true) }}>Add member</Button>}>
    <Table<TeamMember> rowKey="membershipId" size="small" pagination={false} dataSource={current}
      locale={{ emptyText: 'Nobody in this team right now' }}
      columns={[
        { title: 'Member', render: (_, m) => <Space direction="vertical" size={0}><b>{m.employeeName}</b>
          <Typography.Text type="secondary">{m.employeeNumber}</Typography.Text></Space> },
        { title: 'Role', width: 140, render: (_, m) => m.role },
        { title: 'In team since', width: 150, render: (_, m) => when(m.joinedAtUtc) },
        { title: '', width: 140, render: (_, m) => <Space size={4}>
          <Tooltip title="Move to another team"><Button size="small" icon={<SwapOutlined />} disabled={busy || teams.length < 2}
            onClick={() => { moveForm.resetFields(); setMoving(m) }} /></Tooltip>
          <Popconfirm title={`Remove ${m.employeeName} from ${selected.name}?`}
            description="Work already assigned stays on their record and on this team's."
            onConfirm={() => run(() => crewApi.removeMember(selected.id, m.employeeId, {}), 'Member removed')}>
            <Button size="small" danger icon={<DeleteOutlined />} disabled={busy} />
          </Popconfirm>
        </Space> },
      ]} />
    {past.length > 0 && <>
      <Typography.Text strong style={{ display: 'block', marginTop: 16 }}>Previously in this team ({past.length})</Typography.Text>
      <Table<TeamMember> rowKey="membershipId" size="small" pagination={false} dataSource={past} style={{ marginTop: 8 }}
        columns={[
          { title: 'Member', render: (_, m) => m.employeeName },
          { title: 'Role', width: 140, render: (_, m) => m.role },
          { title: 'From', width: 130, render: (_, m) => when(m.joinedAtUtc) },
          { title: 'Until', width: 130, render: (_, m) => when(m.leftAtUtc) },
          { title: 'Why', render: (_, m) => <Typography.Text type="secondary">{m.leaveReason ?? '—'}</Typography.Text> },
        ]} />
    </>}
  </Card>

  return <>
    <PageHeader eyebrow="OPERATIONS" title="Crew" onRefresh={load}
      description="Teams that pack and pick up, who is in them over time, and what each team and person is on record for." />

    <Alert type="info" showIcon style={{ marginBottom: 16 }}
      message="Moving someone does not move their past work"
      description="The team is recorded on each packing job and pickup when the crew is assigned. Moving a member to another team, or renaming a team, never changes who was responsible for work already done." />

    <Tabs items={[
      {
        key: 'teams', label: 'Teams & members', children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {loading && !teams.length ? <Card loading /> : teamsCard}
          {membersCard}
        </Space>,
      },
      {
        key: 'performance', label: 'Performance', children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title="By team">
            <Table rowKey="teamId" size="small" pagination={false} dataSource={overview?.teams ?? []}
              locale={{ emptyText: 'No work recorded against a team yet' }}
              columns={[
                { title: 'Team', render: (_, r) => <Space direction="vertical" size={0}><b>{r.teamName}</b>
                  <Tag color={KIND[r.kind].color}>{KIND[r.kind].label}</Tag></Space> },
                { title: 'Packing jobs', width: 130, render: (_, r) => r.packingJobs },
                { title: 'Pickups', width: 110, render: (_, r) => r.pickups },
                { title: 'Boxes packed', width: 130, render: (_, r) => r.boxesPacked },
                { title: 'Boxes picked', width: 130, render: (_, r) => r.boxesPicked },
                { title: 'People involved', width: 140, render: (_, r) => <Space direction="vertical" size={0}><span>{r.peopleInvolved}</span>
                  <Typography.Text type="secondary">{r.currentMembers} in team now</Typography.Text></Space> },
                { title: 'Last worked', width: 140, render: (_, r) => when(r.lastWorkedAtUtc) },
              ]} />
          </Card>
          <Card size="small" title="By employee">
            <Table rowKey="employeeId" size="small" pagination={false} dataSource={overview?.employees ?? []}
              locale={{ emptyText: 'No work recorded against an employee yet' }}
              columns={[
                { title: 'Employee', render: (_, r) => <Space direction="vertical" size={0}><b>{r.employeeName}</b>
                  <Typography.Text type="secondary">{r.employeeNumber}</Typography.Text></Space> },
                { title: 'Packing jobs', width: 130, render: (_, r) => r.packingJobs },
                { title: 'Pickups', width: 110, render: (_, r) => r.pickups },
                { title: 'Boxes packed', width: 130, render: (_, r) => r.boxesPacked },
                { title: 'Boxes picked', width: 130, render: (_, r) => r.boxesPicked },
                { title: 'Worked under', render: (_, r) => r.teamsWorkedUnder.length
                  ? <Space wrap size={4}>{r.teamsWorkedUnder.map(x => <Tag key={x}>{x}</Tag>)}</Space>
                  : <Typography.Text type="secondary">No team recorded</Typography.Text> },
                { title: 'Last worked', width: 140, render: (_, r) => when(r.lastWorkedAtUtc) },
              ]} />
          </Card>
        </Space>,
      },
    ]} />

    <Modal title={editing ? `Edit ${editing.name}` : 'New team'} open={teamOpen} onCancel={() => setTeamOpen(false)} okText="Save"
      onOk={() => teamForm.validateFields().then(v =>
        run(() => (editing ? crewApi.update(editing.id, v) : crewApi.create(v)), editing ? 'Team saved' : 'Team created').then(() => setTeamOpen(false)))}>
      <Form form={teamForm} layout="vertical">
        <Form.Item name="code" label="Short code" rules={[{ required: true, whitespace: true, message: 'Give the team a code' }]}><Input placeholder="PACK-A" maxLength={40} /></Form.Item>
        <Form.Item name="name" label="Name" rules={[{ required: true, whitespace: true, message: 'Name the team' }]}><Input placeholder="Packing crew A" maxLength={160} /></Form.Item>
        <Form.Item name="kind" label="What it does" rules={[{ required: true }]}>
          <Select options={(Object.keys(KIND) as TeamKind[]).map(k => ({ value: k, label: KIND[k].label }))} />
        </Form.Item>
        <Form.Item name="supervisorEmployeeId" label="Supervisor">
          <Select allowClear showSearch optionFilterProp="label" placeholder="Optional"
            options={employees.filter(e => e.isActive).map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName} · ${e.employeeNumber}` }))} />
        </Form.Item>
        <Form.Item name="notes" label="Notes"><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
      </Form>
    </Modal>

    <Modal title={selected ? `Add a member to ${selected.name}` : ''} open={memberOpen} onCancel={() => setMemberOpen(false)} okText="Add"
      onOk={() => memberForm.validateFields().then(v => selected &&
        run(() => crewApi.addMember(selected.id, v), 'Member added').then(() => setMemberOpen(false)))}>
      <Form form={memberForm} layout="vertical">
        <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Choose an employee' }]}>
          <Select showSearch optionFilterProp="label"
            options={assignable.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName} · ${e.employeeNumber}` }))} />
        </Form.Item>
        <Form.Item name="role" label="Role" rules={[{ required: true }]}>
          <Select options={roles.map(value => ({ value, label: value }))} />
        </Form.Item>
      </Form>
    </Modal>

    <Modal title={moving ? `Move ${moving.employeeName}` : ''} open={!!moving} onCancel={() => setMoving(undefined)} okText="Move"
      onOk={() => moveForm.validateFields().then(v => moving && selected &&
        run(() => crewApi.moveMember(selected.id, { employeeId: moving.employeeId, toTeamId: v.toTeamId, role: v.role, reason: v.reason }), 'Member moved')
          .then(() => setMoving(undefined)))}>
      <Typography.Paragraph type="secondary">
        Their spell in {selected?.name} is closed and a new one opens in the team you choose. Packing jobs and pickups
        they have already been assigned stay on their record, and on {selected?.name}'s.
      </Typography.Paragraph>
      <Form form={moveForm} layout="vertical">
        <Form.Item name="toTeamId" label="Move to" rules={[{ required: true, message: 'Choose the new team' }]}>
          <Select showSearch optionFilterProp="label"
            options={teams.filter(t => t.id !== selected?.id && t.isActive).map(t => ({ value: t.id, label: `${t.name} · ${KIND[t.kind].label}` }))} />
        </Form.Item>
        <Form.Item name="role" label="Role in the new team"><Select allowClear placeholder={moving?.role} options={roles.map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="reason" label="Why"><Input.TextArea rows={2} maxLength={500} placeholder="Cover for leave, permanent transfer…" /></Form.Item>
      </Form>
    </Modal>
  </>
}
