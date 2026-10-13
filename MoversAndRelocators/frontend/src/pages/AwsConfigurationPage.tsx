import { useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Form, Input, Row, Select, Space, Tag, Typography, message } from 'antd'
import { CloudServerOutlined, KeyOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { settingsApi } from '../api'
import type { AwsConfiguration, AwsConfigurationInput } from '../types'
import { PageHeader } from '../components/PageHeader'
import { formatDateTime, useT } from '../i18n'

const regions = [
  'ap-south-1', 'ap-south-2', 'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
  'eu-west-1', 'eu-west-2', 'eu-central-1', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'ca-central-1', 'me-south-1'
].map(value => ({ value, label: value }))

export function AwsConfigurationPage() {
  const { t } = useT()
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
      message.success(t('settings.aws.saved'))
    } catch (reason) { if (reason instanceof Error) message.error(reason.message) }
    finally { setSaving(false) }
  }
  return <>
    <PageHeader onRefresh={load} refreshDisabled={saving || loading} refreshConfirm={t('settings.common.refreshConfirm')} eyebrow={t('settings.common.tenantSettings')} title={t('settings.aws.title')} description={t('settings.aws.description')} />
    <Row gutter={[14, 14]}>
      <Col xs={24} xl={16}>
        <Card className="grid-card aws-settings-card" loading={loading} title={<Space><CloudServerOutlined /> {t('settings.aws.connectionDetails')}</Space>} extra={configuration ? <Tag color="green">{t('settings.common.configured')}</Tag> : <Tag>{t('settings.common.notConfigured')}</Tag>}>
          <Form form={form} layout="vertical" requiredMark="optional">
            <Form.Item label={t('settings.aws.region')} name="region" rules={[{ required: true }, { pattern: /^[a-z]{2}(?:-[a-z0-9]+)+-[0-9]+$/, message: t('settings.aws.regionRule') }]}>
              <Select showSearch optionFilterProp="label" options={regions} placeholder={t('settings.aws.selectRegion')} />
            </Form.Item>
            <Form.Item label={t('settings.aws.bucketName')} name="bucketName" rules={[{ required: true, min: 3, max: 63 }, { pattern: /^[a-z0-9][a-z0-9.-]+[a-z0-9]$/, message: t('settings.aws.bucketRule') }]}><Input placeholder="tenant-upload-bucket" /></Form.Item>
            <Form.Item label={t('settings.aws.accessKey')} name="accessKey" extra={configuration ? t('settings.common.currentCredential', { masked: configuration.maskedAccessKey }) : t('settings.common.requiredInitially')} rules={configuration ? [{ min: 16 }] : [{ required: true, min: 16 }]}>
              <Input.Password autoComplete="new-password" prefix={<KeyOutlined />} placeholder={configuration ? t('settings.common.enterToRotate') : t('settings.aws.enterAccessKey')} />
            </Form.Item>
            <Form.Item label={t('settings.aws.secretKey')} name="secretKey" extra={configuration ? t('settings.aws.secretHidden') : t('settings.common.requiredInitially')} rules={configuration ? [{ min: 16 }] : [{ required: true, min: 16 }]}>
              <Input.Password autoComplete="new-password" prefix={<SafetyCertificateOutlined />} placeholder={configuration ? t('settings.common.enterToRotate') : t('settings.aws.enterSecretKey')} />
            </Form.Item>
            <Button type="primary" loading={saving} onClick={save}>{t('settings.aws.save')}</Button>
          </Form>
        </Card>
      </Col>
      <Col xs={24} xl={8}>
        <Card title={t('settings.aws.credentialSecurity')}>
          <Alert type="success" showIcon message={t('settings.aws.encryptedTitle')} description={t('settings.aws.encryptedText')} />
          <Typography.Paragraph type="secondary" className="aws-security-copy">{t('settings.aws.securityAdvice')}</Typography.Paragraph>
          {configuration && <Typography.Text type="secondary">{t('settings.common.lastUpdated', { when: formatDateTime(configuration.updatedAtUtc) })}</Typography.Text>}
        </Card>
      </Col>
    </Row>
  </>
}
