import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Form, Input, Row, Select, Space, Tag, Typography, message } from 'antd'
import { AudioOutlined, FileSearchOutlined, KeyOutlined, RobotOutlined } from '@ant-design/icons'
import { settingsApi } from '../api'
import type { OpenAiConfiguration, OpenAiConfigurationInput } from '../types'
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
  const load = () => { setLoading(true); return settingsApi.openAi().then(value => {
      setConfiguration(value)
      form.setFieldsValue({ apiKey: null, extractionModel: value?.extractionModel ?? 'gpt-5.6-terra', transcriptionModel: value?.transcriptionModel ?? 'gpt-transcribe' })
    }).catch(error => message.error(error.message)).finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [form])
  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const saved = await settingsApi.saveOpenAi({ ...values, apiKey: values.apiKey || null })
      setConfiguration(saved)
      form.setFieldsValue({ apiKey: null, extractionModel: saved.extractionModel, transcriptionModel: saved.transcriptionModel })
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
            <Button type="primary" loading={saving} onClick={save}>Save OpenAI configuration</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card title="Processing design">
          <Alert type="success" showIcon message="API key encrypted at rest" description="The key is never returned by the API and is excluded from audit payloads." />
          <Typography.Paragraph type="secondary" className="aws-security-copy">PDF pages and images can be passed to a vision-capable extraction model. Raw video should first be converted into selected frames and an audio transcript, then those outputs can be analyzed together.</Typography.Paragraph>
          {configuration && <Typography.Text type="secondary">Last updated {new Date(configuration.updatedAtUtc).toLocaleString()}</Typography.Text>}
        </Card>
      </Col>
    </Row>
  </>
}



