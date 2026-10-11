import { CurrencySelect } from '../currency'
import { useRef, useState } from 'react'
import { Button, Form, Input, Modal, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { request } from '../api'
import type { BusinessMaster } from '../businessMasters'

export function CreateCustomerButton({ getDefaults, onCreated, label = 'Create customer' }: {
  getDefaults: () => Partial<BusinessMaster>; onCreated?: (customer: BusinessMaster) => void; label?: string
}) {
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
      setOpen(false); onCreated?.(customer); message.success(`Customer ${customer.code} created`)
    } catch (error) { if (error instanceof Error) message.error(error.message) }
    finally { saving.current = false; setBusy(false) }
  }
  return <><Button icon={<PlusOutlined />} onClick={show}>{label}</Button>
    <Modal centered title="Create customer" open={open} width={680} okText="Save customer and return" confirmLoading={busy} onOk={() => void save()} onCancel={() => !busy && setOpen(false)} closable={!busy} maskClosable={!busy} keyboard={!busy} destroyOnHidden>
      <p>Review the customer details. Your current page will remain open when you finish.</p>
      <div className="auto-number-note">Customer code is assigned automatically on save</div>
      <Form form={form} layout="vertical" disabled={busy}>
        <Form.Item label="Customer name" name="name" rules={[{ required: true, whitespace: true, max: 120 }]}><Input maxLength={120} /></Form.Item>
        <div className="master-form-grid">
          <Form.Item label="Phone" name="phone"><Input maxLength={40} /></Form.Item>
          <Form.Item label="Email" name="email" rules={[{ type: 'email', transform: value => value?.trim() || undefined }]}><Input maxLength={254} /></Form.Item>
          <Form.Item label="Contact person" name="contactName"><Input maxLength={160} /></Form.Item>
          <Form.Item label="Tax reference" name="taxReference"><Input maxLength={80} /></Form.Item>
        </div>
        <Form.Item name="currency" label="Default currency"><CurrencySelect/></Form.Item><Form.Item label="Address" name="address"><Input.TextArea rows={3} maxLength={600} /></Form.Item>
        <Form.Item label="Notes" name="notes"><Input.TextArea rows={3} maxLength={2000} /></Form.Item>
      </Form>
    </Modal>
  </>
}

