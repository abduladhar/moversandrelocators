import { CurrencySelect } from '../currency'
import { useRef, useState } from 'react'
import { Button, Form, Input, Modal, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { request } from '../api'
import type { BusinessMaster } from '../businessMasters'
import { useT } from '../i18n'

export function CreateCustomerButton({ getDefaults, onCreated, label }: {
  getDefaults: () => Partial<BusinessMaster>; onCreated?: (customer: BusinessMaster) => void; label?: string
}) {
  const { t } = useT()
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false)
  const saving = useRef(false)
  const [form] = Form.useForm<BusinessMaster>()
  const show = () => { form.resetFields(); form.setFieldsValue({ ...getDefaults(), isActive: true }); setOpen(true) }
  const save = async () => {
    if (saving.current) return
    saving.current = true
    try {
      const values = await form.validateFields(); setBusy(true)
      const customer = await request<BusinessMaster>('/api/business-masters/customer/quick-create', { method: 'POST', body: JSON.stringify({ ...values, isActive: true }) })
      setOpen(false); onCreated?.(customer); message.success(t('masters.createCustomer.created', { code: customer.code }))
    } catch (error) { if (error instanceof Error) message.error(error.message) }
    finally { saving.current = false; setBusy(false) }
  }
  return <><Button icon={<PlusOutlined />} onClick={show}>{label ?? t('masters.createCustomer.title')}</Button>
    <Modal centered title={t('masters.createCustomer.title')} open={open} width={680} okText={t('masters.createCustomer.saveAndReturn')} cancelText={t('common.cancel')} confirmLoading={busy} onOk={() => void save()} onCancel={() => !busy && setOpen(false)} closable={!busy} maskClosable={!busy} keyboard={!busy} destroyOnHidden>
      <p>{t('masters.createCustomer.intro')}</p>
      <div className="auto-number-note">{t('masters.createCustomer.autoCode')}</div>
      <Form form={form} layout="vertical" disabled={busy}>
        <Form.Item label={t('masters.createCustomer.name')} name="name" rules={[{ required: true, whitespace: true, max: 120, message: t('masters.nameRequired') }]}><Input maxLength={120} /></Form.Item>
        <div className="master-form-grid">
          <Form.Item label={t('common.phone')} name="phone"><Input maxLength={40} /></Form.Item>
          <Form.Item label={t('common.email')} name="email" rules={[{ type: 'email', transform: value => value?.trim() || undefined, message: t('masters.invalidEmail') }]}><Input maxLength={254} /></Form.Item>
          <Form.Item label={t('masters.contactPerson')} name="contactName"><Input maxLength={160} /></Form.Item>
          <Form.Item label={t('masters.taxReference')} name="taxReference"><Input maxLength={80} /></Form.Item>
        </div>
        <Form.Item name="currency" label={t('masters.defaultCurrency')}><CurrencySelect/></Form.Item><Form.Item label={t('common.address')} name="address"><Input.TextArea rows={3} maxLength={600} /></Form.Item>
        <Form.Item label={t('common.notes')} name="notes"><Input.TextArea rows={3} maxLength={2000} /></Form.Item>
      </Form>
    </Modal>
  </>
}

