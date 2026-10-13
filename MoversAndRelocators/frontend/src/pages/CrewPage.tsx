import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Form, Input, Modal, Popconfirm, Select, Space, Table, Tabs, Tag, Tooltip, Typography, message } from 'antd'
import { DeleteOutlined, EditOutlined, SwapOutlined, TeamOutlined, UserAddOutlined } from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader'
import { employeesApi } from '../api'
import { crewApi, type CrewOverview, type SaveTeam, type Team, type TeamKind, type TeamMember } from '../crewApi'
import type { Employee } from '../types'
import { useBusinessMasters } from '../businessMasters'
import { formatDate, useT } from '../i18n'

/** Tag colour per team kind; the label is crew.kind.<kind>. */
const KIND: Record<TeamKind, { color: string }> = {
  PACKING: { color: 'blue' },
  PICKUP: { color: 'geekblue' },
  BOTH: { color: 'purple' },
}
const when = (x: string | null) => (x ? formatDate(x) : '—')

/** Crew management: teams, who is in them over time, and what each team and person is on record for. */
export function CrewPage() {
  const { t } = useT()
  const kindLabel = (k: TeamKind) => t('crew.kind.' + k)
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
      const [tm, e, p] = await Promise.all([crewApi.teams(showInactive), employeesApi.employees(), crewApi.performance()])
      setTeams(tm); setEmployees(e); setOverview(p)
      setSelectedId(current => (current && tm.some(x => x.id === current) ? current : tm[0]?.id))
    } catch (err) { message.error(err instanceof Error ? err.message : t('crew.page.loadFailed')) }
    finally { setLoading(false) }
  }, [showInactive])
  useEffect(() => { void load() }, [load])

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try { await action(); message.success(done); await load() }
    catch (err) { message.error(err instanceof Error ? err.message : t('crew.page.actionFailed')) }
    finally { setBusy(false) }
  }

  const selected = useMemo(() => teams.find(x => x.id === selectedId), [teams, selectedId])
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
    () => crewApi.seedDemo().then(r => { if (!r.created) throw new Error(t('crew.demo.allExist')) }),
    t('crew.demo.created'))

  const teamsCard = <Card size="small" title={t('crew.teams.title', { count: teams.length })} extra={<Space wrap>
    {canSeedDemo && <Button size="small" loading={busy} onClick={seed}>{t('crew.demo.add')}</Button>}
    <Button size="small" onClick={() => setShowInactive(v => !v)}>{showInactive ? t('crew.teams.hideInactive') : t('crew.teams.showInactive')}</Button>
    <Button size="small" type="primary" icon={<TeamOutlined />} onClick={() => openTeam()}>{t('crew.teams.new')}</Button>
  </Space>}>
    {teams.length === 0
      ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('crew.teams.empty')}>
        {canSeedDemo && <Button type="primary" loading={busy} onClick={seed}>{t('crew.demo.createAll')}</Button>}
      </Empty>
      : <Table<Team> rowKey="id" size="small" pagination={false} dataSource={teams}
        rowClassName={x => (x.id === selectedId ? 'ant-table-row-selected' : '')}
        onRow={x => ({ onClick: () => setSelectedId(x.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: t('crew.teams.team'), render: (_, x) => <Space direction="vertical" size={0}><b>{x.name}</b>
            <Typography.Text type="secondary">{x.supervisorName ? t('crew.teams.supervisedBy', { code: x.code, name: x.supervisorName }) : t('crew.teams.noSupervisor', { code: x.code })}</Typography.Text></Space> },
          { title: t('crew.teams.does'), width: 150, render: (_, x) => <Tag color={KIND[x.kind].color}>{kindLabel(x.kind)}</Tag> },
          { title: t('crew.teams.members'), width: 100, render: (_, x) => x.currentMembers },
          { title: '', width: 90, render: (_, x) => <Space size={4}>
            <Tooltip title={t('common.edit')}><Button size="small" aria-label={t('common.edit')} icon={<EditOutlined />} onClick={e => { e.stopPropagation(); openTeam(x) }} /></Tooltip>
            <Tooltip title={x.isActive ? t('crew.teams.deactivate') : t('crew.teams.reactivate')}>
              <Button size="small" danger={x.isActive} disabled={busy}
                onClick={e => { e.stopPropagation(); void run(() => crewApi.setActive(x.id, !x.isActive), x.isActive ? t('crew.teams.deactivated') : t('crew.teams.reactivated')) }}>
                {x.isActive ? t('crew.teams.off') : t('crew.teams.on')}
              </Button></Tooltip>
          </Space> },
        ]} />}
  </Card>

  const membersCard = selected && <Card size="small" title={t('crew.members.title', { team: selected.name })} extra={
    <Button size="small" type="primary" icon={<UserAddOutlined />} disabled={busy || !assignable.length}
      onClick={() => { memberForm.resetFields(); memberForm.setFieldValue('role', roles[0]); setMemberOpen(true) }}>{t('crew.members.add')}</Button>}>
    <Table<TeamMember> rowKey="membershipId" size="small" pagination={false} dataSource={current}
      locale={{ emptyText: t('crew.members.empty') }}
      columns={[
        { title: t('crew.members.member'), render: (_, m) => <Space direction="vertical" size={0}><b>{m.employeeName}</b>
          <Typography.Text type="secondary">{m.employeeNumber}</Typography.Text></Space> },
        { title: t('crew.members.role'), width: 140, render: (_, m) => m.role },
        { title: t('crew.members.since'), width: 150, render: (_, m) => when(m.joinedAtUtc) },
        { title: '', width: 140, render: (_, m) => <Space size={4}>
          <Tooltip title={t('crew.members.move')}><Button size="small" aria-label={t('crew.members.move')} icon={<SwapOutlined />} disabled={busy || teams.length < 2}
            onClick={() => { moveForm.resetFields(); setMoving(m) }} /></Tooltip>
          <Popconfirm title={t('crew.members.removeTitle', { name: m.employeeName, team: selected.name })}
            description={t('crew.members.removeDescription')} okText={t('common.remove')} cancelText={t('common.cancel')}
            onConfirm={() => run(() => crewApi.removeMember(selected.id, m.employeeId, {}), t('crew.members.removed'))}>
            <Button size="small" danger aria-label={t('common.remove')} icon={<DeleteOutlined />} disabled={busy} />
          </Popconfirm>
        </Space> },
      ]} />
    {past.length > 0 && <>
      <Typography.Text strong style={{ display: 'block', marginTop: 16 }}>{t('crew.members.previous', { count: past.length })}</Typography.Text>
      <Table<TeamMember> rowKey="membershipId" size="small" pagination={false} dataSource={past} style={{ marginTop: 8 }}
        columns={[
          { title: t('crew.members.member'), render: (_, m) => m.employeeName },
          { title: t('crew.members.role'), width: 140, render: (_, m) => m.role },
          { title: t('common.from'), width: 130, render: (_, m) => when(m.joinedAtUtc) },
          { title: t('crew.members.until'), width: 130, render: (_, m) => when(m.leftAtUtc) },
          { title: t('crew.members.why'), render: (_, m) => <Typography.Text type="secondary">{m.leaveReason ?? '—'}</Typography.Text> },
        ]} />
    </>}
  </Card>

  return <>
    <PageHeader eyebrow={t('crew.page.eyebrow')} title={t('crew.page.title')} onRefresh={load}
      description={t('crew.page.description')} />

    <Alert type="info" showIcon style={{ marginBottom: 16 }}
      message={t('crew.page.alertTitle')}
      description={t('crew.page.alertDescription')} />

    <Tabs items={[
      {
        key: 'teams', label: t('crew.page.tabTeams'), children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {loading && !teams.length ? <Card loading /> : teamsCard}
          {membersCard}
        </Space>,
      },
      {
        key: 'performance', label: t('crew.page.tabPerformance'), children: <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title={t('crew.performance.byTeam')}>
            <Table rowKey="teamId" size="small" pagination={false} dataSource={overview?.teams ?? []}
              locale={{ emptyText: t('crew.performance.noTeamWork') }}
              columns={[
                { title: t('crew.teams.team'), render: (_, r) => <Space direction="vertical" size={0}><b>{r.teamName}</b>
                  <Tag color={KIND[r.kind].color}>{kindLabel(r.kind)}</Tag></Space> },
                { title: t('crew.performance.packingJobs'), width: 130, render: (_, r) => r.packingJobs },
                { title: t('crew.performance.pickups'), width: 110, render: (_, r) => r.pickups },
                { title: t('crew.performance.boxesPacked'), width: 130, render: (_, r) => r.boxesPacked },
                { title: t('crew.performance.boxesPicked'), width: 130, render: (_, r) => r.boxesPicked },
                { title: t('crew.performance.peopleInvolved'), width: 140, render: (_, r) => <Space direction="vertical" size={0}><span>{r.peopleInvolved}</span>
                  <Typography.Text type="secondary">{t('crew.performance.inTeamNow', { count: r.currentMembers })}</Typography.Text></Space> },
                { title: t('crew.performance.lastWorked'), width: 140, render: (_, r) => when(r.lastWorkedAtUtc) },
              ]} />
          </Card>
          <Card size="small" title={t('crew.performance.byEmployee')}>
            <Table rowKey="employeeId" size="small" pagination={false} dataSource={overview?.employees ?? []}
              locale={{ emptyText: t('crew.performance.noEmployeeWork') }}
              columns={[
                { title: t('common.employee'), render: (_, r) => <Space direction="vertical" size={0}><b>{r.employeeName}</b>
                  <Typography.Text type="secondary">{r.employeeNumber}</Typography.Text></Space> },
                { title: t('crew.performance.packingJobs'), width: 130, render: (_, r) => r.packingJobs },
                { title: t('crew.performance.pickups'), width: 110, render: (_, r) => r.pickups },
                { title: t('crew.performance.boxesPacked'), width: 130, render: (_, r) => r.boxesPacked },
                { title: t('crew.performance.boxesPicked'), width: 130, render: (_, r) => r.boxesPicked },
                { title: t('crew.performance.workedUnder'), render: (_, r) => r.teamsWorkedUnder.length
                  ? <Space wrap size={4}>{r.teamsWorkedUnder.map(x => <Tag key={x}>{x}</Tag>)}</Space>
                  : <Typography.Text type="secondary">{t('crew.performance.noTeam')}</Typography.Text> },
                { title: t('crew.performance.lastWorked'), width: 140, render: (_, r) => when(r.lastWorkedAtUtc) },
              ]} />
          </Card>
        </Space>,
      },
    ]} />

    <Modal title={editing ? t('crew.teamModal.editTitle', { name: editing.name }) : t('crew.teams.new')} open={teamOpen} onCancel={() => setTeamOpen(false)} okText={t('common.save')} cancelText={t('common.cancel')}
      onOk={() => teamForm.validateFields().then(v =>
        run(() => (editing ? crewApi.update(editing.id, v) : crewApi.create(v)), editing ? t('crew.teamModal.saved') : t('crew.teamModal.created')).then(() => setTeamOpen(false)))}>
      <Form form={teamForm} layout="vertical">
        <Form.Item name="code" label={t('crew.teamModal.code')} rules={[{ required: true, whitespace: true, message: t('crew.teamModal.codeRequired') }]}><Input placeholder={t('crew.teamModal.codePlaceholder')} maxLength={40} /></Form.Item>
        <Form.Item name="name" label={t('common.name')} rules={[{ required: true, whitespace: true, message: t('crew.teamModal.nameRequired') }]}><Input placeholder={t('crew.teamModal.namePlaceholder')} maxLength={160} /></Form.Item>
        <Form.Item name="kind" label={t('crew.teamModal.kind')} rules={[{ required: true, message: t('common.required') }]}>
          <Select options={(Object.keys(KIND) as TeamKind[]).map(k => ({ value: k, label: kindLabel(k) }))} />
        </Form.Item>
        <Form.Item name="supervisorEmployeeId" label={t('crew.teamModal.supervisor')}>
          <Select allowClear showSearch optionFilterProp="label" placeholder={t('common.optional')}
            options={employees.filter(e => e.isActive).map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName} · ${e.employeeNumber}` }))} />
        </Form.Item>
        <Form.Item name="notes" label={t('common.notes')}><Input.TextArea rows={2} maxLength={1000} /></Form.Item>
      </Form>
    </Modal>

    <Modal title={selected ? t('crew.memberModal.title', { team: selected.name }) : ''} open={memberOpen} onCancel={() => setMemberOpen(false)} okText={t('common.add')} cancelText={t('common.cancel')}
      onOk={() => memberForm.validateFields().then(v => selected &&
        run(() => crewApi.addMember(selected.id, v), t('crew.memberModal.added')).then(() => setMemberOpen(false)))}>
      <Form form={memberForm} layout="vertical">
        <Form.Item name="employeeId" label={t('common.employee')} rules={[{ required: true, message: t('crew.memberModal.employeeRequired') }]}>
          <Select showSearch optionFilterProp="label"
            options={assignable.map(e => ({ value: e.id, label: `${e.firstName} ${e.lastName} · ${e.employeeNumber}` }))} />
        </Form.Item>
        <Form.Item name="role" label={t('crew.members.role')} rules={[{ required: true, message: t('common.required') }]}>
          <Select options={roles.map(value => ({ value, label: value }))} />
        </Form.Item>
      </Form>
    </Modal>

    <Modal title={moving ? t('crew.moveModal.title', { name: moving.employeeName }) : ''} open={!!moving} onCancel={() => setMoving(undefined)} okText={t('crew.moveModal.ok')} cancelText={t('common.cancel')}
      onOk={() => moveForm.validateFields().then(v => moving && selected &&
        run(() => crewApi.moveMember(selected.id, { employeeId: moving.employeeId, toTeamId: v.toTeamId, role: v.role, reason: v.reason }), t('crew.moveModal.moved'))
          .then(() => setMoving(undefined)))}>
      <Typography.Paragraph type="secondary">
        {t('crew.moveModal.explanation', { team: selected?.name ?? '' })}
      </Typography.Paragraph>
      <Form form={moveForm} layout="vertical">
        <Form.Item name="toTeamId" label={t('crew.moveModal.to')} rules={[{ required: true, message: t('crew.moveModal.toRequired') }]}>
          <Select showSearch optionFilterProp="label"
            options={teams.filter(x => x.id !== selected?.id && x.isActive).map(x => ({ value: x.id, label: `${x.name} · ${kindLabel(x.kind)}` }))} />
        </Form.Item>
        <Form.Item name="role" label={t('crew.moveModal.newRole')}><Select allowClear placeholder={moving?.role} options={roles.map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item name="reason" label={t('crew.members.why')}><Input.TextArea rows={2} maxLength={500} placeholder={t('crew.moveModal.reasonPlaceholder')} /></Form.Item>
      </Form>
    </Modal>
  </>
}
