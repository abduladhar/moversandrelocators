import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Divider, Form, Input, InputNumber, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { AudioOutlined, DollarOutlined, FileSearchOutlined, KeyOutlined, RobotOutlined } from '@ant-design/icons'
import { settingsApi } from '../api'
import type { AiUsageSummary, AiUsageTotals, OpenAiConfiguration, OpenAiConfigurationInput } from '../types'

const usd = (v: number | null | undefined) => v == null ? '—' : '$' + v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })
const num = (v: number) => v.toLocaleString()
const priceFields = (x?: OpenAiConfiguration) => ({ inputPricePerMillion: x?.inputPricePerMillion ?? null, cachedInputPricePerMillion: x?.cachedInputPricePerMillion ?? null, outputPricePerMillion: x?.outputPricePerMillion ?? null, transcriptionPricePerMinute: x?.transcriptionPricePerMinute ?? null })
import { PageHeader } from '../components/PageHeader'

const extractionModels = [
  { value: 'gpt-5.6-terra', label: 'GPT-5.6 Terra · Balanced' },
  { value: 'gpt-5.6-luna', label: 'GPT-5.6 Luna · High volume' },
  { value: 'gpt-5.6-sol', label: 'GPT-5.6 Sol · Advanced' },
  { value: 'gpt-6-astra', label: 'GPT-6 Astra · Most capable' },
]
const transcriptionModels = [
  { value: 'gpt-transcribe', label: 'GPT Transcribe · High accuracy' },
  { value: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe' },
  { value: 'gpt-4o-mini-transcribe', label: 'GPT-4o Mini Transcribe · Cost efficient' },
]

export function OpenAiConfigurationPage() {
  const [configuration, setConfiguration] = useState<OpenAiConfiguration>()
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<OpenAiConfigurationInput>()
  const [usage, setUsage] = useState<AiUsageSummary>()
  const loadUsage = () => settingsApi.openAiUsage().then(setUsage).catch(() => setUsage(undefined))
  const load = () => { setLoading(true); return settingsApi.openAi().then(value => {
      setConfiguration(value)
      form.setFieldsValue({ apiKey: null, extractionModel: value?.extractionModel ?? 'gpt-5.6-terra', transcriptionModel: value?.transcriptionModel ?? 'gpt-transcribe', ...priceFields(value) })
      void loadUsage()
    }).catch(error => message.error(error.message)).finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [form])
  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const saved = await settingsApi.saveOpenAi({ ...values, apiKey: values.apiKey || null })
      setConfiguration(saved)
      form.setFieldsValue({ apiKey: null, extractionModel: saved.extractionModel, transcriptionModel: saved.transcriptionModel, ...priceFields(saved) })
      void loadUsage()
      message.success('OpenAI configuration saved securely')
    } catch (reason) { if (reason instanceof Error) message.error(reason.message) }
    finally { setSaving(false) }
  }
  return <>
    <PageHeader onRefresh={load} refreshDisabled={saving || loading} refreshConfirm="Refreshing replaces unsaved configuration changes." eyebrow="TENANT SETTINGS" title="OpenAI configuration" description="Configure the tenant API key and models used for extraction and speech-to-text." />
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={16}>
        <Card className="grid-card integration-settings-card" loading={loading} title={<Space><RobotOutlined /> Connection and models</Space>} extra={configuration ? <Tag color="green">Configured</Tag> : <Tag>Not configured</Tag>}>
          <Form form={form} layout="vertical" requiredMark="optional">
            <Form.Item label="OpenAI API key" name="apiKey" extra={configuration ? `Current credential: ${configuration.maskedApiKey}. Leave blank to keep it.` : 'Required for initial configuration.'} rules={configuration ? [{ min: 20 }] : [{ required: true, min: 20 }]}>
              <Input.Password autoComplete="new-password" prefix={<KeyOutlined />} placeholder={configuration ? 'Enter only to rotate' : 'Enter OpenAI API key'} />
            </Form.Item>
            <Form.Item label="Data extraction model" name="extractionModel" extra="Used for structured extraction from text, PDFs and image/video preprocessing outputs." rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={extractionModels} suffixIcon={<FileSearchOutlined />} />
            </Form.Item>
            <Form.Item label="Audio transcription model" name="transcriptionModel" extra="Used to convert uploaded or recorded audio into text." rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={transcriptionModels} suffixIcon={<AudioOutlined />} />
            </Form.Item>
            <Divider titlePlacement="start" plain><DollarOutlined /> Prices (for the approximate cost)</Divider>
            <Typography.Paragraph type="secondary" className="ai-price-hint">Optional. Copy the USD prices of the two models above from OpenAI's pricing page. Each run's cost is worked out with the prices saved at that moment; leave blank to record usage only.</Typography.Paragraph>
            <div className="ai-price-grid">
              <Form.Item label="Input · per 1M tokens" name="inputPricePerMillion"><InputNumber min={0} max={1000} step={0.05} precision={4} prefix="$" style={{ width: '100%' }} placeholder="e.g. 0.40" /></Form.Item>
              <Form.Item label="Cached input · per 1M tokens" name="cachedInputPricePerMillion" extra="Blank = same as input"><InputNumber min={0} max={1000} step={0.01} precision={4} prefix="$" style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Output · per 1M tokens" name="outputPricePerMillion"><InputNumber min={0} max={1000} step={0.05} precision={4} prefix="$" style={{ width: '100%' }} placeholder="e.g. 1.60" /></Form.Item>
              <Form.Item label="Transcription · per minute" name="transcriptionPricePerMinute"><InputNumber min={0} max={1000} step={0.001} precision={4} prefix="$" style={{ width: '100%' }} placeholder="e.g. 0.003" /></Form.Item>
            </div>
            <Button type="primary" loading={saving} onClick={save}>Save OpenAI configuration</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card className="ai-usage-card" title={<Space><DollarOutlined /> Usage &amp; approximate cost</Space>} extra={usage && !usage.pricesConfigured && <Tag color="gold">No prices set</Tag>} style={{ marginBottom: 14 }}>
          {!usage ? <Typography.Text type="secondary">No usage yet.</Typography.Text> : <>
            <div className="ai-usage-totals">{([['This month', usage.thisMonth], ['All time', usage.allTime]] as [string, AiUsageTotals][]).map(([label, t]) => <div key={label}><small>{label}</small><strong>{usd(t.cost)}</strong><span>{t.runs} run{t.runs === 1 ? '' : 's'} · {num(t.inputTokens + t.outputTokens)} tokens{t.audioMinutes ? ' · ' + t.audioMinutes + ' min audio' : ''}</span></div>)}</div>
            {!usage.pricesConfigured && <Alert style={{ marginTop: 10 }} type="info" showIcon title="Enter the prices to see costs. Runs from now on will be priced." />}
          </>}
        </Card>
        <Card title="Processing design">
          <Alert type="success" showIcon title="API key encrypted at rest" description="The key is never returned by the API and is excluded from audit payloads." />
          <Typography.Paragraph type="secondary" className="aws-security-copy">PDF pages and images can be passed to a vision-capable extraction model. Raw video should first be converted into selected frames and an audio transcript, then those outputs can be analyzed together.</Typography.Paragraph>
          {configuration && <Typography.Text type="secondary">Last updated {new Date(configuration.updatedAtUtc).toLocaleString()}</Typography.Text>}
        </Card>
      </Col>
      {usage && usage.recent.length > 0 && <Col xs={24}>
        <Card className="grid-card" title="Recent AI runs">
          <Table size="small" rowKey={r => r.createdAtUtc + r.model} pagination={false} scroll={{ x: 820 }} dataSource={usage.recent} columns={[
            { title: 'When', dataIndex: 'createdAtUtc', render: (v: string) => new Date(v).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) },
            { title: 'Sales lead', render: (_: unknown, r: AiUsageSummary['recent'][number]) => r.leadNumber ? <>{r.leadNumber}<br /><small>{r.customerName}</small></> : '—' },
            { title: 'Model', dataIndex: 'model' },
            { title: 'Tokens in / out', align: 'right' as const, render: (_: unknown, r: AiUsageSummary['recent'][number]) => num(r.inputTokens) + ' / ' + num(r.outputTokens) },
            { title: 'Audio', dataIndex: 'audioSeconds', align: 'right' as const, render: (v: number) => v ? Math.round(v) + ' s' : '—' },
            { title: 'Approx. cost', dataIndex: 'cost', align: 'right' as const, render: (v: number | null) => usd(v) },
            { title: 'By', dataIndex: 'createdBy' }]} />
        </Card>
      </Col>}
    </Row>
  </>
}



