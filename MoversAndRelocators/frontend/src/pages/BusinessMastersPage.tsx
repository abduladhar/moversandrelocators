import { CurrencySelect } from "../currency"
import { useState } from 'react'
import { AutoComplete, Button, Card, Form, Input, Modal, Select, Switch, Tag, message } from 'antd'
import { PageHeader } from '../components/PageHeader'
import { DataGrid } from '../components/DataGrid'
import { RowActions } from '../components/RowActions'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { businessMastersApi, useBusinessMasters, type MasterKind, type BusinessMaster } from '../businessMasters'
import { useCompanyScopes } from '../companyScope'
const labels: Record<MasterKind, string> = { 'crew-role': 'Crew roles', 'payment-method': 'Payment methods', 'payment-purpose': 'Payment purposes', 'expense-category': 'Expense categories', customer: 'Customers', vendor: 'Vendors' }
export function BusinessMastersPage({ kind }: { kind: MasterKind }) {
 const { rows, reload } = useBusinessMasters(kind)
 const scopes = useCompanyScopes(kind)
 const [query, setQuery] = useState(''), [active, setActive] = useState<boolean>(), [open, setOpen] = useState(false), [editing, setEditing] = useState<BusinessMaster>(), [saving, setSaving] = useState(false)
 const [form] = Form.useForm<BusinessMaster & { availableIn?: 'all' | 'company' }>()
 const contact = kind === 'customer' || kind === 'vendor'
 const show = (row?: BusinessMaster) => { setEditing(row); form.resetFields(); form.setFieldsValue({ ...(row ?? { name: '', isActive: true }), availableIn: row && scopes.isCompanyOnly(row.code) ? 'company' : 'all' }); setOpen(true) }
 const save = async () => { const { availableIn, ...value } = await form.validateFields(); setSaving(true); try { const saved = await businessMastersApi.save(kind, value, editing?.code); if (scopes.enabled && (availableIn === 'company') !== scopes.isCompanyOnly(saved.code)) await scopes.set(saved.code, availableIn === 'company'); await reload(); setOpen(false); message.success('Master saved') } catch (e) { message.error(e instanceof Error ? e.message : 'Unable to save') } finally { setSaving(false) } }
 const filtered = rows.filter(x => `${x.name} ${x.code} ${x.phone ?? ''} ${x.email ?? ''} ${x.vendorType ?? ''} ${x.isAgent ? 'agent' : ''}`.toLowerCase().includes(query.toLowerCase()) && (active === undefined || x.isActive === active))
 return <><PageHeader eyebrow="MASTER DATA" title={labels[kind]} description={contact ? 'Maintain contact details for your company’s customers and suppliers.' : 'Configure the choices available during pickup operations. Inactive entries remain in historical records.'} onRefresh={reload} action="Add record" onAction={() => show()} filters={<AdvancedSearch value={query} onChange={setQuery} active={active !== undefined} onReset={() => { setQuery(''); setActive(undefined) }}><Select allowClear placeholder="Status" value={active} onChange={setActive} options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} /></AdvancedSearch>} />
 <Card className="grid-card" title={labels[kind]} extra={`${filtered.length} records`}><DataGrid rowKey="code" dataSource={filtered} pagination={{ pageSize: 20 }} scroll={{ x: 720 }} columns={[
 { title: 'Code', dataIndex: 'code' }, { title: 'Name', dataIndex: 'name' },
 ...(contact ? [{ title: 'Phone', dataIndex: 'phone' }, { title: 'Email', dataIndex: 'email' }, { title: 'Contact person', dataIndex: 'contactName' }, { title: 'Currency', dataIndex: 'currency' }] : []),
 ...(kind === 'vendor' ? [{ title: 'Vendor type', dataIndex: 'vendorType' }, { title: 'Agent', dataIndex: 'isAgent', render: (value: boolean) => value ? <Tag color="green">Agent</Tag> : '—' }] : []),
 ...scopes.column<BusinessMaster>(row => row.code),
 { title: 'Status', dataIndex: 'isActive', render: value => <Tag color={value ? 'green' : 'default'}>{value ? 'Active' : 'Inactive'}</Tag> },
 { title: 'Actions', key: 'actions', width: 80, render: (_, row) => <RowActions><Button onClick={() => show(row)}>Edit</Button></RowActions> },
 ]} /></Card>
 <Modal centered title={editing ? 'Edit ' + labels[kind].toLowerCase() : 'Add ' + labels[kind].toLowerCase()} open={open} width={contact ? 760 : 520} onCancel={() => !saving && setOpen(false)} onOk={() => void save()} okText="Save" confirmLoading={saving} destroyOnHidden><Form form={form} layout="vertical" disabled={saving}>
 <div className="auto-number-note">{editing?.code ?? 'Code is assigned automatically on save'}</div>
 <Form.Item label="Name" name="name" rules={[{ required: true, whitespace: true, max: 120 }]}><Input maxLength={120} /></Form.Item>
 {contact && <><Form.Item name="currency" label="Default currency" extra="Leave empty to use the location default for a new record."><CurrencySelect/></Form.Item><div className="master-form-grid"><Form.Item label="Phone" name="phone"><Input maxLength={40} /></Form.Item><Form.Item label="Email" name="email" rules={[{ type: 'email', transform: value => value?.trim() || undefined }]}><Input maxLength={254} /></Form.Item><Form.Item label="Contact person" name="contactName"><Input maxLength={160} /></Form.Item><Form.Item label="Tax reference" name="taxReference"><Input maxLength={80} /></Form.Item></div><Form.Item label="Address" name="address"><Input.TextArea rows={2} maxLength={600} /></Form.Item></>}
 {kind === 'vendor' && <div className="master-form-grid"><Form.Item label="Vendor type (optional)" name="vendorType"><AutoComplete maxLength={80} placeholder="Select or enter a vendor type" options={['Transporter','Shipping line','Airline','Freight forwarder','Customs broker','Warehouse provider','Packing supplier','Other'].map(value => ({ value }))} /></Form.Item><Form.Item label="Agent" name="isAgent" valuePropName="checked" extra="Enable to make this vendor available as an origin or destination agent. Optional."><Switch /></Form.Item></div>}
 <Form.Item label="Notes" name="notes"><Input.TextArea rows={2} maxLength={2000} /></Form.Item><Form.Item label="Active" name="isActive" valuePropName="checked"><Switch /></Form.Item>
 {scopes.enabled && <Form.Item label="Available in" name="availableIn" extra="All companies: every company of the group can use it. Company only: hidden from the other companies."><Select options={[{ value: 'all', label: 'All companies' }, { value: 'company', label: `${scopes.companyName ?? 'This company'} only` }]} /></Form.Item>}
 </Form></Modal></>
}


