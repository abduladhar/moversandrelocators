import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Divider, Form, Input, InputNumber, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { DollarOutlined, ExperimentOutlined, FileSearchOutlined, KeyOutlined } from '@ant-design/icons'
import { settingsApi } from '../api'
import type { AiUsageSummary, AiUsageTotals, ClaudeConfiguration, ClaudeConfigurationInput } from '../types'
import { PageHeader } from '../components/PageHeader'

const usd = (v: number | null | undefined) => v == null ? '—' : '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })
const num = (v: number) => v.toLocaleString()
const priceFields = (x?: ClaudeConfiguration) => ({ inputPricePerMillion: x?.inputPricePerMillion ?? null, cachedInputPricePerMillion: x?.cachedInputPricePerMillion ?? null, outputPricePerMillion: x?.outputPricePerMillion ?? null })

/** Anthropic list prices (USD per 1M tokens) used to fill the price fields when a model is chosen; edit them if your contract differs. */
const extractionModels = [
  { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 · Recommended', prices: { inputPricePerMillion: 4, cachedInputPricePerMillion: 0.4, outputPricePerMillion: 20 } },
  { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 · Balanced', prices: { inputPricePerMillion: 2, cachedInputPricePerMillion: 0.2, outputPricePerMillion: 10 } },
  { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 · High volume, lowest cost', prices: { inputPricePerMillion: 0.1, cachedInputPricePerMillion: null, outputPricePerMillion: 0.5 } },
  { value: 'claude-fable-5-1', label: 'Claude Fable 5.1 · Most capable', prices: { inputPricePerMillion: 10, cachedInputPricePerMillion: 0.25, outputPricePerMillion: 50 } },
]
const efforts = [
  { value: 'low', label: 'Low · fastest and cheapest' },
  { value: 'medium', label: 'Medium · recommended' },
  { value: 'high', label: 'High · most careful counting, slower' },
]

export function ClaudeConfigurationPage() {
  const [configuration, setConfiguration] = useState<ClaudeConfiguration>()
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<ClaudeConfigurationInput>()
  const [usage, setUsage] = useState<AiUsageSummary>()
  const loadUsage = () => settingsApi.claudeUsage().then(setUsage).catch(() => setUsage(undefined))
  const load = () => { setLoading(true); return settingsApi.claude().then(value => {
      setConfiguration(value)
      form.setFieldsValue({ apiKey: null, extractionModel: value?.extractionModel ?? 'claude-opus-5-5', effort: value?.effort ?? 'medium', ...(value ? priceFields(value) : extractionModels[0].prices) })
      void loadUsage()
    }).catch(error => message.error(error.message)).finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [form])
  const modelChanged = (model: string) => { const known = extractionModels.find(m => m.value === model); if (known) form.setFieldsValue(known.prices) }
  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const saved = await settingsApi.saveClaude({ ...values, apiKey: values.apiKey || null })
      setConfiguration(saved)
      form.setFieldsValue({ apiKey: null, extractionModel: saved.extractionModel, effort: saved.effort, ...priceFields(saved) })
      void loadUsage()
      message.success('Claude configuration saved securely')
    } catch (reason) { if (reason instanceof Error) message.error(reason.message) }
    finally { setSaving(false) }
  }
  return <>
    <PageHeader onRefresh={load} refreshDisabled={saving || loading} refreshConfirm="Refreshing replaces unsaved configuration changes." eyebrow="TENANT SETTINGS" title="Claude configuration" description="Configure the tenant Anthropic API key and the Claude model used to extract items from sales-lead photos and videos." />
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={16}>
        <Card className="grid-card integration-settings-card" loading={loading} title={<Space><ExperimentOutlined /> Connection and model</Space>} extra={configuration ? <Tag color="green">Configured</Tag> : <Tag>Not configured</Tag>}>
          <Form form={form} layout="vertical" requiredMark="optional">
            <Form.Item label="Anthropic API key" name="apiKey" extra={configuration ? `Current credential: ${configuration.maskedApiKey}. Leave blank to keep it.` : 'Required for initial configuration. Create one in the Claude Console (console.anthropic.com).'} rules={configuration ? [{ min: 20 }] : [{ required: true, min: 20 }]}>
              <Input.Password autoComplete="new-password" prefix={<KeyOutlined />} placeholder={configuration ? 'Enter only to rotate' : 'sk-ant-…'} />
            </Form.Item>
            <Form.Item label="Extraction model" name="extractionModel" extra="Reads the photo or the video frames and returns the rooms, items, fragile pieces and boxes." rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={extractionModels.map(({ value, label }) => ({ value, label }))} suffixIcon={<FileSearchOutlined />} onChange={modelChanged} />
            </Form.Item>
            <Form.Item label="Effort" name="effort" extra="How long Claude thinks before answering. Higher effort counts busy rooms more carefully but takes longer and uses more output tokens." rules={[{ required: true }]}>
              <Select options={efforts} />
            </Form.Item>
            <Divider titlePlacement="start" plain><DollarOutlined /> Prices (for the approximate cost)</Divider>
            <Typography.Paragraph type="secondary" className="ai-price-hint">Filled with Anthropic's list prices when you pick a model; adjust them to your contract. Each run's cost is worked out with the prices saved at that moment. Speech-to-text is priced in Settings › OpenAI.</Typography.Paragraph>
            <div className="ai-price-grid">
              <Form.Item label="Input · per 1M tokens" name="inputPricePerMillion"><InputNumber min={0} max={1000} step={0.05} precision={4} prefix="$" style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Cached input · per 1M tokens" name="cachedInputPricePerMillion" extra="Blank = same as input"><InputNumber min={0} max={1000} step={0.01} precision={4} prefix="$" style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Output · per 1M tokens" name="outputPricePerMillion"><InputNumber min={0} max={1000} step={0.05} precision={4} prefix="$" style={{ width: '100%' }} /></Form.Item>
            </div>
            <Button type="primary" loading={saving} onClick={save}>Save Claude configuration</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card className="ai-usage-card" title={<Space><DollarOutlined /> Claude usage &amp; approximate cost</Space>} extra={usage && !usage.pricesConfigured && <Tag color="gold">No prices set</Tag>} style={{ marginBottom: 14 }}>
          {!usage ? <Typography.Text type="secondary">No usage yet.</Typography.Text> : <>
            <div className="ai-usage-totals">{([['This month', usage.thisMonth], ['All time', usage.allTime]] as [string, AiUsageTotals][]).map(([label, t]) => <div key={label}><small>{label}</small><strong>{usd(t.cost)}</strong><span>{t.runs} run{t.runs === 1 ? '' : 's'} · {num(t.inputTokens + t.outputTokens)} tokens{t.audioMinutes ? ' · ' + t.audioMinutes + ' min audio' : ''}</span></div>)}</div>
            {!usage.pricesConfigured && <Alert style={{ marginTop: 10 }} type="info" showIcon title="Enter the prices to see costs. Runs from now on will be priced." />}
          </>}
        </Card>
        <Card title="Processing design">
          <Alert type="success" showIcon title="API key encrypted at rest" description="The key is never returned by the API and is excluded from audit payloads." />
          <Typography.Paragraph type="secondary" className="aws-security-copy">Claude reads pictures, not video files. For a video, still frames are stored in S3 next to it and Claude receives short-lived signed links to them. Claude cannot listen to sound, so when OpenAI is also configured the narration is transcribed by OpenAI and given to Claude as text.</Typography.Paragraph>
          {configuration && <Typography.Text type="secondary">Last updated {new Date(configuration.updatedAtUtc).toLocaleString()}</Typography.Text>}
        </Card>
      </Col>
      {usage && usage.recent.length > 0 && <Col xs={24}>
        <Card className="grid-card" title="Recent Claude runs">
          <Table size="small" rowKey={r => r.createdAtUtc + r.model} pagination={false} scroll={{ x: 820 }} dataSource={usage.recent} columns={[
            { title: 'When', dataIndex: 'createdAtUtc', render: (v: string) => new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) },
            { title: 'Sales lead', render: (_: unknown, r: AiUsageSummary['recent'][number]) => r.leadNumber ? <>{r.leadNumber}<br /><small>{r.customerName}</small></> : '—' },
            { title: 'Model', dataIndex: 'model' },
            { title: 'Tokens in / out', align: 'right' as const, render: (_: unknown, r: AiUsageSummary['recent'][number]) => num(r.inputTokens) + ' / ' + num(r.outputTokens) },
            { title: 'Audio (OpenAI)', dataIndex: 'audioSeconds', align: 'right' as const, render: (v: number) => v ? Math.round(v) + ' s' : '—' },
            { title: 'Approx. cost', dataIndex: 'cost', align: 'right' as const, render: (v: number | null) => usd(v) },
            { title: 'By', dataIndex: 'createdBy' }]} />
        </Card>
      </Col>}
    </Row>
  </>
}
