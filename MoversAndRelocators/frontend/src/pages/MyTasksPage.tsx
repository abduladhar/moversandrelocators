import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Empty, List, Row, Skeleton, Statistic, Tag, Typography, message } from 'antd'
import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons'
import { tasksApi } from '../api'
import type { MyTask } from '../types'
import { PageHeader } from '../components/PageHeader'

export function MyTasksPage({ onNavigate }: { onNavigate: (target: string) => void }) {
  const [tasks, setTasks] = useState<MyTask[]>([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try { setTasks(await tasksApi.mine()) }
    catch (reason) { message.error(reason instanceof Error ? reason.message : 'Unable to load tasks.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const overdue = useMemo(() => tasks.filter(x => x.isOverdue).length, [tasks])
  const today = tasks.length - overdue

  return <>
    <PageHeader onRefresh={load} eyebrow="MY WORKSPACE" title="My tasks" description="Your overdue and due-today work, gathered from every module in one place." />
    <Row gutter={[12, 12]} className="stats-row">
      <Col xs={12} md={8}><Card><Statistic title="Due today" value={today} prefix={<CalendarOutlined />} /></Card></Col>
      <Col xs={12} md={8}><Card><Statistic title="Overdue" value={overdue} valueStyle={{ color: overdue ? '#cf1322' : undefined }} prefix={<ClockCircleOutlined />} /></Card></Col>
      <Col xs={24} md={8}><Card><Statistic title="Total attention" value={tasks.length} prefix={<CheckCircleOutlined />} /></Card></Col>
    </Row>
    <Card className="grid-card task-inbox" title="Today’s work" extra={`${tasks.length} tasks`}>
      {loading ? <div className="task-loading"><Skeleton active paragraph={{ rows: 5 }} /></div> : tasks.length ? <List dataSource={tasks} renderItem={task => <List.Item actions={[<Button key="open" type="link" onClick={() => onNavigate(task.navigationTarget)}>Open <RightOutlined /></Button>]}><List.Item.Meta avatar={<div className={`task-icon ${task.isOverdue ? 'is-overdue' : ''}`}><ClockCircleOutlined /></div>} title={<span>{task.title} <Tag color={task.isOverdue ? 'red' : 'blue'}>{task.isOverdue ? 'Overdue' : 'Today'}</Tag></span>} description={<><Typography.Text type="secondary">{task.description}</Typography.Text><small className="task-meta">{task.module} · Due {new Date(task.dueAtUtc).toLocaleString()}</small></>} /></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>No tasks need attention today.<small className="task-empty-note">Follow-ups appear here when the assigned employee’s work email matches the signed-in user.</small></span>} />}
    </Card>
  </>
}


