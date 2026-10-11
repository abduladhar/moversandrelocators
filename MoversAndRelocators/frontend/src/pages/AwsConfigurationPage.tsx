import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Form, Input, Row, Select, Space, Tag, Typography, message } from 'antd'
import { CloudServerOutlined, KeyOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { settingsApi } from '../api'
import type { AwsConfiguration, AwsConfigurationInput } from '../types'
import { PageHeader } from '../components/PageHeader'

const regions = [
  'ap-south-1', 'ap-south-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
  'eu-west-1', 'eu-west-2', 'eu-central-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1', 'me-south-1'
].map(value => ({ value, label: value }))

export function AwsConfigurationPage() {
  const [configuration, setConfiguration] = useState<AwsConfiguration>()
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false)
  const [form] = Form.useForm<AwsConfigurationInput>()
  const load = () => { setLoading(true); return settingsApi.aws().then(value => {
      setConfiguration(value)
      form.setFieldsValue({ region: value?.region ?? 'ap-south-1', bucketName: value?.bucketName ?? '', accessKey: null, secretKey: null })
    }).catch(error => message.error(error.message)).finally(() => setLoading(false))
  }
  useEffect(() => { void load() }, [form])
  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const saved = await settingsApi.saveAws({ region: values.region, bucketName: values.bucketName, accessKey: values.accessKey || null, secretKey: values.secretKey || null })
      setConfiguration(saved)
      form.setFieldsValue({ region: saved.region, bucketName: saved.bucketName, accessKey: null, secretKey: null })
      message.success('AWS configuration saved securely')
    } catch (reason) { if (reason instanceof Error) message.error(reason.message) }
    finally { setSaving(false) }
  }
  return <>
    <PageHeader onRefresh={load} refreshDisabled={saving || loading} refreshConfirm="Refreshing replaces unsaved configuration changes." eyebrow="TENANT SETTINGS" title="AWS configuration" description="Configure the AWS account credentials used by this tenant." />
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={16}>
        <Card className="grid-card aws-settings-card" loading={loading} title={<Space><CloudServerOutlined /> Connection details</Space>} extra={configuration ? <Tag color="green">Configured</Tag> : <Tag>Not configured</Tag>}>
          <Form form={form} layout="vertical" requiredMark="optional">
            <Form.Item label="AWS region" name="region" rules={[{ required: true }, { pattern: /^[a-z]{2}(?:-[a-z0-9]+)+-[0-9]+$/, message: 'Enter a valid AWS region such as ap-south-1.' }]}>
              <Select showSearch optionFilterProp="label" options={regions} placeholder="Select AWS region" />
            </Form.Item>
            <Form.Item label="S3 bucket name" name="bucketName" rules={[{ required: true, min: 3, max: 63 }, { pattern: /^[a-z0-9][a-z0-9.-]+[a-z0-9]$/, message: 'Enter a valid lowercase S3 bucket name.' }]}><Input placeholder="tenant-upload-bucket" /></Form.Item>
            <Form.Item label="AWS access key ID" name="accessKey" extra={configuration ? `Current credential: ${configuration.maskedAccessKey}. Leave blank to keep it.` : 'Required for initial configuration.'} rules={configuration ? [{ min: 16 }] : [{ required: true, min: 16 }]}>
              <Input.Password autoComplete="new-password" prefix={<KeyOutlined />} placeholder={configuration ? 'Enter only to rotate' : 'Enter access key ID'} />
            </Form.Item>
            <Form.Item label="AWS secret access key" name="secretKey" extra={configuration ? 'The stored secret cannot be viewed. Leave blank to keep it.' : 'Required for initial configuration.'} rules={configuration ? [{ min: 16 }] : [{ required: true, min: 16 }]}>
              <Input.Password autoComplete="new-password" prefix={<SafetyCertificateOutlined />} placeholder={configuration ? 'Enter only to rotate' : 'Enter secret access key'} />
            </Form.Item>
            <Button type="primary" loading={saving} onClick={save}>Save AWS configuration</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card title="Credential security">
          <Alert type="success" showIcon message="Encrypted at rest" description="Access and secret keys are encrypted before database storage and are never returned by the API." />
          <Typography.Paragraph type="secondary" className="aws-security-copy">Use an IAM user or role with only the permissions required by this tenant. Rotate credentials regularly and override the application encryption key in production.</Typography.Paragraph>
          {configuration && <Typography.Text type="secondary">Last updated {new Date(configuration.updatedAtUtc).toLocaleString()}</Typography.Text>}
        </Card>
      </Col>
    </Row>
  </>
}



