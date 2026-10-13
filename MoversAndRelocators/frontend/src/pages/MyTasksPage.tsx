import { useEffect, useMemo, useState } from 'react'
import { Button, Card, Col, Empty, List, Row, Skeleton, Statistic, Tag, Typography, message } from 'antd'
import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { tasksApi } from '../api'
import type { MyTask } from '../types'
import { PageHeader } from '../components/PageHeader'
import { formatDateTime, useT } from '../i18n'

export function MyTasksPage({ onNavigate }: { onNavigate: (target: string) => void }) {
  const { t, dir } = useT()
  const [tasks, setTasks] = useState<MyTask[]>([])
  const [loading, setLoading] = useState(true)
  const load = async () => {
    setLoading(true)
    try { setTasks(await tasksApi.mine()) }
    catch (reason) { message.error(reason instanceof Error ? reason.message : t('admin.myTasks.loadFailed')) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const overdue = useMemo(() => tasks.filter(x => x.isOverdue).length, [tasks])
  const today = tasks.length - overdue

  return <>
    <PageHeader onRefresh={load} eyebrow={t('admin.myTasks.eyebrow')} title={t('admin.myTasks.title')} description={t('admin.myTasks.description')} />
    <Row gutter={[12, 12]} className="stats-row">
      <Col xs={12} md={8}><Card><Statistic title={t('admin.myTasks.dueToday')} value={today} prefix={<CalendarOutlined />} /></Card></Col>
      <Col xs={12} md={8}><Card><Statistic title={t('admin.myTasks.overdue')} value={overdue} valueStyle={{ color: overdue ? '#cf1322' : undefined }} prefix={<ClockCircleOutlined />} /></Card></Col>
      <Col xs={24} md={8}><Card><Statistic title={t('admin.myTasks.totalAttention')} value={tasks.length} prefix={<CheckCircleOutlined />} /></Card></Col>
    </Row>
    <Card className="grid-card task-inbox" title={t('admin.myTasks.todaysWork')} extra={t('admin.myTasks.taskCount', { count: tasks.length })}>
      {loading ? <div className="task-loading"><Skeleton active paragraph={{ rows: 5 }} /></div> : tasks.length ? <List dataSource={tasks} renderItem={task => <List.Item actions={[<Button key="open" type="link" onClick={() => onNavigate(task.navigationTarget)}>{t('common.open')} {dir === 'rtl' ? <LeftOutlined /> : <RightOutlined />}</Button>]}><List.Item.Meta avatar={<div className={`task-icon ${task.isOverdue ? 'is-overdue' : ''}`}><ClockCircleOutlined /></div>} title={<span>{task.title} <Tag color={task.isOverdue ? 'red' : 'blue'}>{task.isOverdue ? t('admin.myTasks.overdue') : t('admin.myTasks.today')}</Tag></span>} description={<><Typography.Text type="secondary">{task.description}</Typography.Text><small className="task-meta">{t('admin.myTasks.moduleDue', { module: task.module, due: formatDateTime(task.dueAtUtc) })}</small></>} /></List.Item>} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>{t('admin.myTasks.empty')}<small className="task-empty-note">{t('admin.myTasks.emptyNote')}</small></span>} />}
    </Card>
  </>
}
