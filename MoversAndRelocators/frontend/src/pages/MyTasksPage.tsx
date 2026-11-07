import { useEffect, useState, type ReactNode } from 'react'
import { Alert, Button, Card, Col, DatePicker, Empty, Form, Input, List, Modal, Row, Segmented, Select, Skeleton, Space, Statistic, Tag, Timeline, Typography, message } from 'antd'
import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, EditOutlined, HistoryOutlined, InboxOutlined, LeftOutlined, RightOutlined, UserOutlined, UserSwitchOutlined } from '@ant-design/icons'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'
import { tasksApi, type TaskHistoryStep, type TaskOptions, type TaskSummary } from '../api'
import type { MyTask } from '../types'
import { PageHeader } from '../components/PageHeader'
import { formatDateTime, useT } from '../i18n'
import { tokens } from '../theme'

type Dialog = { task: MyTask; kind: 'update' | 'reassign' }
type UpdateValues = { statusId?: string; dueAt?: Dayjs | null; note?: string }
type ReassignValues = { employeeId: string; note?: string }
type State = 'open' | 'completed' | 'all'
const pageSize = 20

/**
 * My Tasks: the user's work from every module, newest first, open tasks by default. Each task can be opened, updated
 * (status, new date, a note), handed to someone else, or its history shown; changes are made on the record behind it
 * (follow-up, survey or customer reply), and the history comes from that record's audit trail.
 */
export function MyTasksPage({ onNavigate }: { onNavigate: (target: string) => void }) {
  const { t, dir } = useT()
  const [tasks, setTasks] = useState<MyTask[]>([]), [total, setTotal] = useState(0)
  const [summary, setSummary] = useState<TaskSummary>({ open: 0, dueToday: 0, overdue: 0, completed: 0 })
  const [state, setState] = useState<State>('open'), [search, setSearch] = useState(''), [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [options, setOptions] = useState<TaskOptions>({ followUpStatuses: [], employees: [] })
  const [dialog, setDialog] = useState<Dialog | null>(null), [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<{ task: MyTask; steps: TaskHistoryStep[] | null } | null>(null)
  const [updateForm] = Form.useForm<UpdateValues>(), [reassignForm] = Form.useForm<ReassignValues>()
  const load = async () => {
    setLoading(true)
    try {
      const result = await tasksApi.search({ state, search: search.trim() || undefined, skip: (page - 1) * pageSize, take: pageSize })
      setTasks(result.items); setTotal(result.total); if (result.summary) setSummary(result.summary)
    } catch (reason) { message.error(reason instanceof Error ? reason.message : t('admin.myTasks.loadFailed')) }
    finally { setLoading(false) }
  }
  useEffect(() => { tasksApi.options().then(setOptions).catch(() => undefined) }, [])
  // Typing waits a moment before searching; the filter and the page load at once.
  useEffect(() => { const timer = window.setTimeout(() => void load(), search ? 300 : 0); return () => window.clearTimeout(timer) }, [state, search, page])
  const filter = (next: State) => { setState(next); setPage(1) }

  const surveyStatus = (code: string) => t(`surveys.status.${code}`) === `surveys.status.${code}` ? code : t(`surveys.status.${code}`)
  const statusText = (type: string, status: string | null | undefined) => !status ? null
    : type === 'survey' ? surveyStatus(status)
    : status === 'REPLIED' ? t('admin.myTasks.replied') : status === 'HANDLED' ? t('admin.myTasks.handled') : status
  const canReassign = (task: MyTask) => task.isOpen && task.type !== 'customer-reply' && options.employees.length > 0
  const canUpdate = (task: MyTask) => task.isOpen && (task.type !== 'sales_follow_up' || options.followUpStatuses.length > 0)
  const timing = (task: MyTask) => !task.isOpen ? <Tag color="success">{t('admin.myTasks.completed')}</Tag>
    : task.isOverdue ? <Tag color="red">{t('admin.myTasks.overdue')}</Tag>
    : dayjs(task.dueAtUtc).isSame(dayjs(), 'day') ? <Tag color="blue">{t('admin.myTasks.today')}</Tag> : <Tag>{t('admin.myTasks.upcoming')}</Tag>

  const showHistory = (task: MyTask) => {
    setHistory({ task, steps: null })
    tasksApi.history(task.id).then(steps => setHistory(current => current?.task.id === task.id ? { task, steps } : current))
      .catch(reason => { setHistory(null); message.error(reason instanceof Error ? reason.message : t('admin.myTasks.historyFailed')) })
  }
  const stepText = (task: MyTask, step: TaskHistoryStep) => {
    const status = (value: string | null) => statusText(task.type, value) ?? ''
    switch (step.event) {
      case 'OPENED': return step.to ? t('admin.myTasks.history.openedAs', { status: status(step.to) }) : t('admin.myTasks.history.opened')
      case 'COMPLETED': return t('admin.myTasks.history.completed')
      case 'REOPENED': return step.to ? t('admin.myTasks.history.reopenedAs', { status: status(step.to) }) : t('admin.myTasks.history.reopened')
      case 'STATUS': return t('admin.myTasks.history.status', { from: status(step.from), to: status(step.to) })
      case 'RESCHEDULED': return t('admin.myTasks.history.rescheduled', { date: step.date ? formatDateTime(step.date) : '' })
      case 'REASSIGNED': return step.from ? t('admin.myTasks.history.reassignedFrom', { from: step.from, to: step.to ?? '' }) : t('admin.myTasks.history.reassigned', { to: step.to ?? '' })
      case 'NOTE': return t('admin.myTasks.history.note')
      default: return step.event
    }
  }
  const stepColor = (event: string) => event === 'COMPLETED' ? 'green' : event === 'OPENED' ? 'blue' : event === 'REOPENED' ? 'orange' : 'gray'

  // The dialogs are rebuilt each time they open (destroyOnHidden), so their forms start from initialValues.
  const open = (task: MyTask, kind: Dialog['kind']) => setDialog({ task, kind })
  const save = async () => {
    if (!dialog) return
    const { task, kind } = dialog
    try {
      setSaving(true)
      if (kind === 'update') {
        const v = await updateForm.validateFields()
        await tasksApi.update(task.id, { statusId: task.type === 'sales_follow_up' ? v.statusId ?? null : null, dueAtUtc: v.dueAt ? v.dueAt.toISOString() : null, note: v.note?.trim() || null })
        message.success(task.type === 'customer-reply' ? t('admin.myTasks.handledDone') : t('admin.myTasks.updated'))
      } else {
        const v = await reassignForm.validateFields()
        await tasksApi.reassign(task.id, { employeeId: v.employeeId, note: v.note?.trim() || null })
        message.success(t('admin.myTasks.reassigned', { name: options.employees.find(x => x.id === v.employeeId)?.name ?? '' }))
      }
      setDialog(null); await load()
    } catch (reason) { if (reason instanceof Error) message.error(reason.message) }
    finally { setSaving(false) }
  }

  const selectedStatus = Form.useWatch('statusId', updateForm)
  const closesTask = options.followUpStatuses.find(x => x.id === selectedStatus)?.isCompleted
  const task = dialog?.task
  const updateTitle = task?.type === 'customer-reply' ? t('admin.myTasks.markHandled') : t('admin.myTasks.updateTask')
  const card = (key: State | null, title: string, value: number, icon: ReactNode, danger = false) =>
    <Card hoverable={Boolean(key)} className={key && key === state ? 'task-stat is-active' : 'task-stat'} onClick={key ? () => filter(key) : undefined}>
      <Statistic title={title} value={value} prefix={icon} styles={{ content: { color: danger && value ? tokens.danger : undefined } }} /></Card>

  return <>
    <PageHeader onRefresh={load} eyebrow={t('admin.myTasks.eyebrow')} title={t('admin.myTasks.title')} description={t('admin.myTasks.description')} />
    <Row gutter={[12, 12]} className="stats-row">
      <Col xs={12} md={6}>{card('open', t('admin.myTasks.openTasks'), summary.open, <InboxOutlined />)}</Col>
      <Col xs={12} md={6}>{card(null, t('admin.myTasks.dueToday'), summary.dueToday, <CalendarOutlined />)}</Col>
      <Col xs={12} md={6}>{card(null, t('admin.myTasks.overdue'), summary.overdue, <ClockCircleOutlined />, true)}</Col>
      <Col xs={12} md={6}>{card('completed', t('admin.myTasks.completed'), summary.completed, <CheckCircleOutlined />)}</Col>
    </Row>
    <Card className="grid-card task-inbox" title={<div className="task-toolbar">
        <Segmented<State> value={state} onChange={filter} options={[{ value: 'open', label: t('admin.myTasks.filterOpen') }, { value: 'completed', label: t('admin.myTasks.filterCompleted') }, { value: 'all', label: t('admin.myTasks.filterAll') }]} />
        <Input.Search allowClear value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} placeholder={t('admin.myTasks.searchPlaceholder')} aria-label={t('admin.myTasks.searchPlaceholder')} />
      </div>} extra={t('admin.myTasks.taskCount', { count: total })}>
      {loading && !tasks.length ? <div className="task-loading"><Skeleton active paragraph={{ rows: 5 }} /></div> : tasks.length ? <List loading={loading} dataSource={tasks}
        pagination={total > pageSize ? { current: page, pageSize, total, onChange: setPage, showSizeChanger: false, align: 'center' } : false}
        renderItem={task => <List.Item className={`task-row${task.isOpen ? '' : ' is-completed'}`} actions={[
        canUpdate(task) && <Button key="update" size="small" icon={task.type === 'customer-reply' ? <CheckCircleOutlined /> : <EditOutlined />} onClick={() => open(task, 'update')}>{task.type === 'customer-reply' ? t('admin.myTasks.markHandled') : t('admin.myTasks.update')}</Button>,
        canReassign(task) && <Button key="reassign" size="small" icon={<UserSwitchOutlined />} onClick={() => open(task, 'reassign')}>{t('admin.myTasks.reassign')}</Button>,
        <Button key="history" size="small" icon={<HistoryOutlined />} onClick={() => showHistory(task)}>{t('admin.myTasks.historyButton')}</Button>,
        <Button key="open" size="small" type="link" onClick={() => onNavigate(task.navigationTarget)}>{t('common.open')} {dir === 'rtl' ? <LeftOutlined /> : <RightOutlined />}</Button>,
      ].filter(Boolean)}>
        <List.Item.Meta avatar={<div className={`task-icon ${task.isOverdue ? 'is-overdue' : ''}${task.isOpen ? '' : ' is-done'}`}>{task.isOpen ? <ClockCircleOutlined /> : <CheckCircleOutlined />}</div>}
          title={<span>{task.title} {timing(task)}</span>}
          description={<><Typography.Text type="secondary">{task.description}</Typography.Text>
            <small className="task-meta">{task.module}
              {task.createdAtUtc && <> · {t('admin.myTasks.createdOn', { date: formatDateTime(task.createdAtUtc) })}</>}
              {task.isOpen ? <> · {t('admin.myTasks.dueOn', { date: formatDateTime(task.dueAtUtc) })}</> : task.completedAtUtc && <> · {t('admin.myTasks.completedOn', { date: formatDateTime(task.completedAtUtc) })}</>}
              {statusText(task.type, task.status) && <> · {t('admin.myTasks.statusLine', { status: statusText(task.type, task.status)! })}</>}
              {task.assignedTo && <> · <UserOutlined /> {task.assignedTo}</>}</small></>} />
      </List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>{search ? t('admin.myTasks.noMatch') : state === 'completed' ? t('admin.myTasks.noneCompleted') : t('admin.myTasks.empty')}
        {!search && state !== 'completed' && <small className="task-empty-note">{t('admin.myTasks.emptyNote')}</small>}</span>} />}
    </Card>

    <Modal open={Boolean(history)} title={t('admin.myTasks.historyTitle')} footer={null} onCancel={() => setHistory(null)} destroyOnHidden width={560}>
      {history && <>
        <Typography.Paragraph type="secondary" className="task-dialog-subject">{history.task.title} · {history.task.description}</Typography.Paragraph>
        {!history.steps ? <Skeleton active paragraph={{ rows: 4 }} /> : history.steps.length ? <Timeline className="task-history" items={history.steps.map((step, index) => ({
          key: index, color: stepColor(step.event),
          content: <div className="task-history-step"><strong>{stepText(history.task, step)}</strong>
            <span className="task-history-when">{formatDateTime(step.atUtc)}{step.actor && <> · {t('admin.myTasks.history.by', { name: step.actor })}</>}</span>
            {step.note && <Typography.Paragraph className="task-history-note">{step.note}</Typography.Paragraph>}</div>,
        }))} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('admin.myTasks.noHistory')} />}
      </>}
    </Modal>

    <Modal open={dialog?.kind === 'update'} title={updateTitle} okText={task?.type === 'customer-reply' ? t('admin.myTasks.markHandled') : t('admin.myTasks.save')} cancelText={t('common.cancel')}
      onOk={() => void save()} onCancel={() => setDialog(null)} confirmLoading={saving} destroyOnHidden width={560}>
      {task && <Form form={updateForm} layout="vertical" requiredMark={false} className="task-dialog-form" initialValues={{ statusId: task.statusId ?? undefined }}>
        <Typography.Paragraph type="secondary" className="task-dialog-subject">{task.title} · {task.description}</Typography.Paragraph>
        {task.type === 'sales_follow_up' && <>
          <Form.Item name="statusId" label={t('admin.myTasks.status')} rules={[{ required: true }]}>
            <Select options={options.followUpStatuses.map(x => ({ value: x.id, label: x.name }))} /></Form.Item>
          <Form.Item name="dueAt" label={closesTask ? t('admin.myTasks.nextFollowUp') : t('admin.myTasks.newDate')} extra={closesTask ? t('admin.myTasks.completedHint') : t('admin.myTasks.newDateHint')}>
            <DatePicker showTime={{ format: 'HH:mm' }} format="DD MMM YYYY HH:mm" style={{ width: '100%' }} disabledDate={d => d.isBefore(dayjs(), 'day')} /></Form.Item>
        </>}
        {task.type === 'survey' && <>
          <Alert type="info" showIcon title={t('admin.myTasks.surveyStatusHint')} className="task-dialog-alert" />
          <Form.Item name="dueAt" label={t('admin.myTasks.newSurveyTime')} extra={t('admin.myTasks.newSurveyTimeHint')}>
            <DatePicker showTime={{ format: 'HH:mm' }} format="DD MMM YYYY HH:mm" style={{ width: '100%' }} disabledDate={d => d.isBefore(dayjs(), 'day')} /></Form.Item>
        </>}
        <Form.Item name="note" label={task.type === 'customer-reply' ? t('admin.myTasks.whatDone') : t('admin.myTasks.note')} extra={task.type === 'customer-reply' ? undefined : t('admin.myTasks.noteHint')} rules={[{ max: 1000 }]}>
          <Input.TextArea rows={3} maxLength={1000} placeholder={t('admin.myTasks.notePlaceholder')} /></Form.Item>
      </Form>}
    </Modal>

    <Modal open={dialog?.kind === 'reassign'} title={t('admin.myTasks.reassignTitle')} okText={t('admin.myTasks.reassign')} cancelText={t('common.cancel')}
      onOk={() => void save()} onCancel={() => setDialog(null)} confirmLoading={saving} destroyOnHidden width={560}>
      {task && <Form form={reassignForm} layout="vertical" requiredMark={false} className="task-dialog-form">
        <Typography.Paragraph type="secondary" className="task-dialog-subject">{task.title} · {task.description}</Typography.Paragraph>
        {task.assignedTo && <Typography.Paragraph className="task-dialog-subject"><Space size={6}><UserOutlined />{t('admin.myTasks.currentlyWith', { name: task.assignedTo })}</Space></Typography.Paragraph>}
        <Form.Item name="employeeId" label={t('admin.myTasks.assignTo')} rules={[{ required: true, message: t('admin.myTasks.assignToRequired') }]}
          extra={task.type === 'sales_follow_up' ? t('admin.myTasks.reassignLeadHint') : t('admin.myTasks.reassignSurveyHint')}>
          <Select showSearch optionFilterProp="label" placeholder={t('admin.myTasks.choosePerson')}
            options={options.employees.filter(x => x.id !== task.assignedEmployeeId).map(x => ({ value: x.id, label: x.name }))} /></Form.Item>
        <Form.Item name="note" label={t('admin.myTasks.handoverNote')} rules={[{ max: 1000 }]}>
          <Input.TextArea rows={3} maxLength={1000} placeholder={t('admin.myTasks.handoverPlaceholder')} /></Form.Item>
      </Form>}
    </Modal>
  </>
}
