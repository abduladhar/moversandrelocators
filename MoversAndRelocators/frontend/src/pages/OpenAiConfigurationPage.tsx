import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Divider, Form, Input, InputNumber, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { AudioOutlined, DollarOutlined, FileSearchOutlined, KeyOutlined, RobotOutlined } from '@ant-design/icons'
import { settingsApi } from '../api'
import type { AiUsageSummary, AiUsageTotals, OpenAiConfiguration, OpenAiConfigurationInput } from '../types'
import { formatDateTime, formatNumber, useT } from '../i18n'

const usd = (v: number | null | undefined) => v == null ? '—' : '$' + formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })
const num = (v: number) => formatNumber(v)
const priceFields = (x?: OpenAiConfiguration) => ({ inputPricePerMillion: x?.inputPricePerMillion ?? null, cachedInputPricePerMillion: x?.cachedInputPricePerMillion ?? null, outputPricePerMillion: x?.outputPricePerMillion ?? null, transcriptionPricePerMinute: x?.transcriptionPricePerMinute ?? null })
import { PageHeader } from '../components/PageHeader'

export function OpenAiConfigurationPage() {
  const { t } = useT()
  // Model names are product names; only the descriptions are translated.
  const extractionModels = [
    { value: 'gpt-5.6-terra', label: `GPT-5.6 Terra · ${t('settings.openai.models.balanced')}` },
    { value: 'gpt-5.6-luna', label: `GPT-5.6 Luna · ${t('settings.openai.models.highVolume')}` },
    { value: 'gpt-5.6-sol', label: `GPT-5.6 Sol · ${t('settings.openai.models.advanced')}` },
    { value: 'gpt-6-astra', label: `GPT-6 Astra · ${t('settings.openai.models.mostCapable')}` },
  ]
  const transcriptionModels = [
    { value: 'gpt-transcribe', label: `GPT Transcribe · ${t('settings.openai.models.highAccuracy')}` },
    { value: 'gpt-4o-transcribe', label: 'GPT-4o Transcribe' },
    { value: 'gpt-4o-mini-transcribe', label: `GPT-4o Mini Transcribe · ${t('settings.openai.models.costEfficient')}` },
  ]
  const usageLine = (x: AiUsageTotals) => [t('settings.ai.runs', { count: x.runs }), t('settings.ai.tokens', { tokens: num(x.inputTokens + x.outputTokens) }), ...(x.audioMinutes ? [t('settings.ai.audioMinutes', { minutes: x.audioMinutes })] : [])].join(' · ')
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
      message.success(t('settings.openai.saved'))
    } catch (reason) { if (reason instanceof Error) message.error(reason.message) }
    finally { setSaving(false) }
  }
  return <>
    <PageHeader onRefresh={load} refreshDisabled={saving || loading} refreshConfirm={t('settings.common.refreshConfirm')} eyebrow={t('settings.common.tenantSettings')} title={t('settings.openai.title')} description={t('settings.openai.description')} />
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={16}>
        <Card className="grid-card integration-settings-card" loading={loading} title={<Space><RobotOutlined /> {t('settings.openai.connectionAndModels')}</Space>} extra={configuration ? <Tag color="green">{t('settings.common.configured')}</Tag> : <Tag>{t('settings.common.notConfigured')}</Tag>}>
          <Form form={form} layout="vertical" requiredMark="optional">
            <Form.Item label={t('settings.openai.apiKey')} name="apiKey" extra={configuration ? t('settings.common.currentCredential', { masked: configuration.maskedApiKey }) : t('settings.common.requiredInitially')} rules={configuration ? [{ min: 20 }] : [{ required: true, min: 20 }]}>
              <Input.Password autoComplete="new-password" prefix={<KeyOutlined />} placeholder={configuration ? t('settings.common.enterToRotate') : t('settings.openai.enterApiKey')} />
            </Form.Item>
            <Form.Item label={t('settings.openai.extractionModel')} name="extractionModel" extra={t('settings.openai.extractionModelHint')} rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={extractionModels} suffixIcon={<FileSearchOutlined />} />
            </Form.Item>
            <Form.Item label={t('settings.openai.transcriptionModel')} name="transcriptionModel" extra={t('settings.openai.transcriptionModelHint')} rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={transcriptionModels} suffixIcon={<AudioOutlined />} />
            </Form.Item>
            <Divider titlePlacement="start" plain><DollarOutlined /> {t('settings.ai.pricesTitle')}</Divider>
            <Typography.Paragraph type="secondary" className="ai-price-hint">{t('settings.openai.pricesHint')}</Typography.Paragraph>
            <div className="ai-price-grid">
              <Form.Item label={t('settings.ai.inputPrice')} name="inputPricePerMillion"><InputNumber min={0} max={1000} step={0.05} precision={4} prefix="$" style={{ width: '100%' }} placeholder={t('settings.ai.example', { value: '0.40' })} /></Form.Item>
              <Form.Item label={t('settings.ai.cachedInputPrice')} name="cachedInputPricePerMillion" extra={t('settings.ai.cachedBlank')}><InputNumber min={0} max={1000} step={0.01} precision={4} prefix="$" style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('settings.ai.outputPrice')} name="outputPricePerMillion"><InputNumber min={0} max={1000} step={0.05} precision={4} prefix="$" style={{ width: '100%' }} placeholder={t('settings.ai.example', { value: '1.60' })} /></Form.Item>
              <Form.Item label={t('settings.openai.transcriptionPrice')} name="transcriptionPricePerMinute"><InputNumber min={0} max={1000} step={0.001} precision={4} prefix="$" style={{ width: '100%' }} placeholder={t('settings.ai.example', { value: '0.003' })} /></Form.Item>
            </div>
            <Button type="primary" loading={saving} onClick={save}>{t('settings.openai.save')}</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card className="ai-usage-card" title={<Space><DollarOutlined /> {t('settings.ai.usageTitle')}</Space>} extra={usage && !usage.pricesConfigured && <Tag color="gold">{t('settings.ai.noPrices')}</Tag>} style={{ marginBottom: 14 }}>
          {!usage ? <Typography.Text type="secondary">{t('settings.ai.noUsage')}</Typography.Text> : <>
            <div className="ai-usage-totals">{([[t('settings.ai.thisMonth'), usage.thisMonth], [t('settings.ai.allTime'), usage.allTime]] as [string, AiUsageTotals][]).map(([label, x]) => <div key={label}><small>{label}</small><strong>{usd(x.cost)}</strong><span>{usageLine(x)}</span></div>)}</div>
            {!usage.pricesConfigured && <Alert style={{ marginTop: 10 }} type="info" showIcon title={t('settings.ai.enterPrices')} />}
          </>}
        </Card>
        <Card title={t('settings.ai.processingDesign')}>
          <Alert type="success" showIcon title={t('settings.ai.keyEncryptedTitle')} description={t('settings.ai.keyEncryptedText')} />
          <Typography.Paragraph type="secondary" className="aws-security-copy">{t('settings.openai.processingText')}</Typography.Paragraph>
          {configuration && <Typography.Text type="secondary">{t('settings.common.lastUpdated', { when: formatDateTime(configuration.updatedAtUtc) })}</Typography.Text>}
        </Card>
      </Col>
      {usage && usage.recent.length > 0 && <Col xs={24}>
        <Card className="grid-card" title={t('settings.openai.recentRuns')}>
          <Table size="small" rowKey={r => r.createdAtUtc + r.model} pagination={false} scroll={{ x: 820 }} dataSource={usage.recent} columns={[
            { title: t('settings.ai.when'), dataIndex: 'createdAtUtc', render: (v: string) => formatDateTime(v) },
            { title: t('settings.ai.salesLead'), render: (_: unknown, r: AiUsageSummary['recent'][number]) => r.leadNumber ? <>{r.leadNumber}<br /><small>{r.customerName}</small></> : '—' },
            { title: t('settings.ai.model'), dataIndex: 'model' },
            { title: t('settings.ai.tokensInOut'), align: 'right' as const, render: (_: unknown, r: AiUsageSummary['recent'][number]) => num(r.inputTokens) + ' / ' + num(r.outputTokens) },
            { title: t('settings.ai.audio'), dataIndex: 'audioSeconds', align: 'right' as const, render: (v: number) => v ? t('settings.ai.seconds', { seconds: Math.round(v) }) : '—' },
            { title: t('settings.ai.approxCost'), dataIndex: 'cost', align: 'right' as const, render: (v: number | null) => usd(v) },
            { title: t('settings.ai.by'), dataIndex: 'createdBy' }]} />
        </Card>
      </Col>}
    </Row>
  </>
}
