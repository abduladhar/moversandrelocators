import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Divider, Form, Input, InputNumber, Row, Select, Space, Table, Tag, Typography, message } from 'antd'
import { DollarOutlined, ExperimentOutlined, FileSearchOutlined, KeyOutlined } from '@ant-design/icons'
import { settingsApi } from '../api'
import type { AiUsageSummary, AiUsageTotals, ClaudeConfiguration, ClaudeConfigurationInput } from '../types'
import { PageHeader } from '../components/PageHeader'
import { formatDateTime, formatNumber, useT } from '../i18n'

const usd = (v: number | null | undefined) => v == null ? '—' : '$' + formatNumber(v, { minimumFractionDigits: 2, maximumFractionDigits: v < 1 ? 4 : 2 })
const num = (v: number) => formatNumber(v)
const priceFields = (x?: ClaudeConfiguration) => ({ inputPricePerMillion: x?.inputPricePerMillion ?? null, cachedInputPricePerMillion: x?.cachedInputPricePerMillion ?? null, outputPricePerMillion: x?.outputPricePerMillion ?? null })

/** Anthropic list prices (USD per 1M tokens) used to fill the price fields when a model is chosen; edit them if your contract differs. */
const extractionModels = [
  { value: 'claude-opus-5-5', name: 'Claude Opus 5.5', note: 'recommended', prices: { inputPricePerMillion: 4, cachedInputPricePerMillion: 0.4, outputPricePerMillion: 20 } },
  { value: 'claude-sonnet-5-5', name: 'Claude Sonnet 5.5', note: 'balanced', prices: { inputPricePerMillion: 2, cachedInputPricePerMillion: 0.2, outputPricePerMillion: 10 } },
  { value: 'claude-haiku-5-5', name: 'Claude Haiku 5.5', note: 'lowestCost', prices: { inputPricePerMillion: 0.1, cachedInputPricePerMillion: null, outputPricePerMillion: 0.5 } },
  { value: 'claude-fable-5-1', name: 'Claude Fable 5.1', note: 'mostCapable', prices: { inputPricePerMillion: 10, cachedInputPricePerMillion: 0.25, outputPricePerMillion: 50 } },
]

export function ClaudeConfigurationPage() {
  const { t } = useT()
  const efforts = [
    { value: 'low', label: t('settings.claude.efforts.low') },
    { value: 'medium', label: t('settings.claude.efforts.medium') },
    { value: 'high', label: t('settings.claude.efforts.high') },
  ]
  const usageLine = (x: AiUsageTotals) => [t('settings.ai.runs', { count: x.runs }), t('settings.ai.tokens', { tokens: num(x.inputTokens + x.outputTokens) }), ...(x.audioMinutes ? [t('settings.ai.audioMinutes', { minutes: x.audioMinutes })] : [])].join(' · ')
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
      message.success(t('settings.claude.saved'))
    } catch (reason) { if (reason instanceof Error) message.error(reason.message) }
    finally { setSaving(false) }
  }
  return <>
    <PageHeader onRefresh={load} refreshDisabled={saving || loading} refreshConfirm={t('settings.common.refreshConfirm')} eyebrow={t('settings.common.tenantSettings')} title={t('settings.claude.title')} description={t('settings.claude.description')} />
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={16}>
        <Card className="grid-card integration-settings-card" loading={loading} title={<Space><ExperimentOutlined /> {t('settings.claude.connectionAndModel')}</Space>} extra={configuration ? <Tag color="green">{t('settings.common.configured')}</Tag> : <Tag>{t('settings.common.notConfigured')}</Tag>}>
          <Form form={form} layout="vertical" requiredMark="optional">
            <Form.Item label={t('settings.claude.apiKey')} name="apiKey" extra={configuration ? t('settings.common.currentCredential', { masked: configuration.maskedApiKey }) : t('settings.claude.requiredInitially')} rules={configuration ? [{ min: 20 }] : [{ required: true, min: 20 }]}>
              <Input.Password autoComplete="new-password" prefix={<KeyOutlined />} placeholder={configuration ? t('settings.common.enterToRotate') : 'sk-ant-…'} />
            </Form.Item>
            <Form.Item label={t('settings.claude.extractionModel')} name="extractionModel" extra={t('settings.claude.extractionModelHint')} rules={[{ required: true }]}>
              <Select showSearch optionFilterProp="label" options={extractionModels.map(({ value, name, note }) => ({ value, label: `${name} · ${t('settings.claude.models.' + note)}` }))} suffixIcon={<FileSearchOutlined />} onChange={modelChanged} />
            </Form.Item>
            <Form.Item label={t('settings.claude.effort')} name="effort" extra={t('settings.claude.effortHint')} rules={[{ required: true }]}>
              <Select options={efforts} />
            </Form.Item>
            <Divider titlePlacement="start" plain><DollarOutlined /> {t('settings.ai.pricesTitle')}</Divider>
            <Typography.Paragraph type="secondary" className="ai-price-hint">{t('settings.claude.pricesHint')}</Typography.Paragraph>
            <div className="ai-price-grid">
              <Form.Item label={t('settings.ai.inputPrice')} name="inputPricePerMillion"><InputNumber min={0} max={1000} step={0.05} precision={4} prefix="$" style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('settings.ai.cachedInputPrice')} name="cachedInputPricePerMillion" extra={t('settings.ai.cachedBlank')}><InputNumber min={0} max={1000} step={0.01} precision={4} prefix="$" style={{ width: '100%' }} /></Form.Item>
              <Form.Item label={t('settings.ai.outputPrice')} name="outputPricePerMillion"><InputNumber min={0} max={1000} step={0.05} precision={4} prefix="$" style={{ width: '100%' }} /></Form.Item>
            </div>
            <Button type="primary" loading={saving} onClick={save}>{t('settings.claude.save')}</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card className="ai-usage-card" title={<Space><DollarOutlined /> {t('settings.claude.usageTitle')}</Space>} extra={usage && !usage.pricesConfigured && <Tag color="gold">{t('settings.ai.noPrices')}</Tag>} style={{ marginBottom: 14 }}>
          {!usage ? <Typography.Text type="secondary">{t('settings.ai.noUsage')}</Typography.Text> : <>
            <div className="ai-usage-totals">{([[t('settings.ai.thisMonth'), usage.thisMonth], [t('settings.ai.allTime'), usage.allTime]] as [string, AiUsageTotals][]).map(([label, x]) => <div key={label}><small>{label}</small><strong>{usd(x.cost)}</strong><span>{usageLine(x)}</span></div>)}</div>
            {!usage.pricesConfigured && <Alert style={{ marginTop: 10 }} type="info" showIcon title={t('settings.ai.enterPrices')} />}
          </>}
        </Card>
        <Card title={t('settings.ai.processingDesign')}>
          <Alert type="success" showIcon title={t('settings.ai.keyEncryptedTitle')} description={t('settings.ai.keyEncryptedText')} />
          <Typography.Paragraph type="secondary" className="aws-security-copy">{t('settings.claude.processingText')}</Typography.Paragraph>
          {configuration && <Typography.Text type="secondary">{t('settings.common.lastUpdated', { when: formatDateTime(configuration.updatedAtUtc) })}</Typography.Text>}
        </Card>
      </Col>
      {usage && usage.recent.length > 0 && <Col xs={24}>
        <Card className="grid-card" title={t('settings.claude.recentRuns')}>
          <Table size="small" rowKey={r => r.createdAtUtc + r.model} pagination={false} scroll={{ x: 820 }} dataSource={usage.recent} columns={[
            { title: t('settings.ai.when'), dataIndex: 'createdAtUtc', render: (v: string) => formatDateTime(v) },
            { title: t('settings.ai.salesLead'), render: (_: unknown, r: AiUsageSummary['recent'][number]) => r.leadNumber ? <>{r.leadNumber}<br /><small>{r.customerName}</small></> : '—' },
            { title: t('settings.ai.model'), dataIndex: 'model' },
            { title: t('settings.ai.tokensInOut'), align: 'right' as const, render: (_: unknown, r: AiUsageSummary['recent'][number]) => num(r.inputTokens) + ' / ' + num(r.outputTokens) },
            { title: t('settings.claude.audioOpenAi'), dataIndex: 'audioSeconds', align: 'right' as const, render: (v: number) => v ? t('settings.ai.seconds', { seconds: Math.round(v) }) : '—' },
            { title: t('settings.ai.approxCost'), dataIndex: 'cost', align: 'right' as const, render: (v: number | null) => usd(v) },
            { title: t('settings.ai.by'), dataIndex: 'createdBy' }]} />
        </Card>
      </Col>}
    </Row>
  </>
}
