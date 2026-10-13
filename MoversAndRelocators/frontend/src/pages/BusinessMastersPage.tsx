import { CurrencySelect } from "../currency"
import { useState } from 'react'
import { AutoComplete, Button, Card, Form, Input, Modal, Select, Switch, Tag, message } from 'antd'
import { PageHeader } from '../components/PageHeader'
import { DataGrid } from '../components/DataGrid'
import { RowActions } from '../components/RowActions'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { businessMastersApi, useBusinessMasters, type MasterKind, type BusinessMaster } from '../businessMasters'
import { useCompanyScopes } from '../companyScope'
import { useT } from '../i18n'
/** Translation keys under masters.business.kinds.<key>. */
const kindKeys: Record<MasterKind, string> = { 'crew-role': 'crewRole', 'payment-method': 'paymentMethod', 'payment-purpose': 'paymentPurpose', 'expense-category': 'expenseCategory', customer: 'customer', vendor: 'vendor', 'message-template': 'messageTemplate' }
/** Suggested vendor types (keys under masters.business.vendorTypes); the chosen text is saved as shown. */
const vendorTypes = ['transporter', 'shippingLine', 'airline', 'freightForwarder', 'customsBroker', 'warehouseProvider', 'packingSupplier', 'other']
/** Placeholders a message template may use; the screen that sends it supplies the values it knows. */
const PLACEHOLDERS = '{{customer}} · {{reference}} · {{link}} · {{date}} · {{amount}} · {{origin}} · {{destination}}'
export function BusinessMastersPage({ kind }: { kind: MasterKind }) {
 const { t } = useT()
 const kindText = (key: 'title' | 'add' | 'edit') => t(`masters.business.kinds.${kindKeys[kind]}.${key}`)
 const { rows, reload } = useBusinessMasters(kind)
 const scopes = useCompanyScopes(kind === 'message-template' ? null : kind)
 const [query, setQuery] = useState(''), [active, setActive] = useState<boolean>(), [open, setOpen] = useState(false), [editing, setEditing] = useState<BusinessMaster>(), [saving, setSaving] = useState(false)
 const [form] = Form.useForm<BusinessMaster & { availableIn?: 'all' | 'company' }>()
 const contact = kind === 'customer' || kind === 'vendor'
 // A template belongs to the screen that sends it, so its code is fixed: the wording is what can be changed.
 const template = kind === 'message-template'
 const show = (row?: BusinessMaster) => { setEditing(row); form.resetFields(); form.setFieldsValue({ ...(row ?? { name: '', isActive: true }), availableIn: row && scopes.isCompanyOnly(row.code) ? 'company' : 'all' }); setOpen(true) }
 const save = async () => { const { availableIn, ...value } = await form.validateFields(); setSaving(true); try { const saved = await businessMastersApi.save(kind, value, editing?.code); if (scopes.enabled && (availableIn === 'company') !== scopes.isCompanyOnly(saved.code)) await scopes.set(saved.code, availableIn === 'company'); await reload(); setOpen(false); message.success(t('masters.business.saved')) } catch (e) { message.error(e instanceof Error ? e.message : t('masters.business.saveFailed')) } finally { setSaving(false) } }
 const filtered = rows.filter(x => `${x.name} ${x.code} ${x.phone ?? ''} ${x.email ?? ''} ${x.vendorType ?? ''} ${x.isAgent ? 'agent' : ''}`.toLowerCase().includes(query.toLowerCase()) && (active === undefined || x.isActive === active))
 return <><PageHeader eyebrow={t('masters.business.eyebrow')} title={kindText('title')} description={template ? t('masters.business.templateDescription') : contact ? t('masters.business.contactDescription') : t('masters.business.choiceDescription')} onRefresh={reload} {...(template ? {} : { action: t('masters.business.addRecord'), onAction: () => show() })} filters={<AdvancedSearch value={query} onChange={setQuery} active={active !== undefined} onReset={() => { setQuery(''); setActive(undefined) }}><Select allowClear placeholder={t('common.status')} value={active} onChange={setActive} options={[{ value: true, label: t('common.active') }, { value: false, label: t('common.inactive') }]} /></AdvancedSearch>} />
 <Card className="grid-card" title={kindText('title')} extra={t('masters.records', { count: filtered.length })}><DataGrid rowKey="code" dataSource={filtered} pagination={{ pageSize: 20 }} scroll={{ x: 720 }} columns={[
 { title: t('common.code'), dataIndex: 'code' }, { title: t('common.name'), dataIndex: 'name' },
 ...(template ? [{ title: t('masters.business.message'), dataIndex: 'notes', render: (value: string) => <span className="template-preview">{value}</span> }] : []),
 ...(contact ? [{ title: t('common.phone'), dataIndex: 'phone' }, { title: t('common.email'), dataIndex: 'email' }, { title: t('masters.contactPerson'), dataIndex: 'contactName' }, { title: t('common.currency'), dataIndex: 'currency' }] : []),
 ...(kind === 'vendor' ? [{ title: t('masters.business.vendorType'), dataIndex: 'vendorType' }, { title: t('masters.business.agent'), dataIndex: 'isAgent', render: (value: boolean) => value ? <Tag color="green">{t('masters.business.agent')}</Tag> : '—' }] : []),
 ...scopes.column<BusinessMaster>(row => row.code),
 { title: t('common.status'), dataIndex: 'isActive', render: value => <Tag color={value ? 'green' : 'default'}>{value ? t('common.active') : t('common.inactive')}</Tag> },
 { title: t('common.actions'), key: 'actions', width: 80, render: (_, row) => <RowActions><Button onClick={() => show(row)}>{t('common.edit')}</Button></RowActions> },
 ]} /></Card>
 <Modal centered title={editing ? kindText('edit') : kindText('add')} open={open} width={contact ? 760 : 520} onCancel={() => !saving && setOpen(false)} onOk={() => void save()} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} destroyOnHidden><Form form={form} layout="vertical" disabled={saving}>
 <div className="auto-number-note">{editing?.code ?? (template ? '' : t('masters.business.autoCode'))}</div>
 <Form.Item label={t('common.name')} name="name" rules={[{ required: true, whitespace: true, max: 120, message: t('masters.nameRequired') }]}><Input maxLength={120} /></Form.Item>
 {contact && <><Form.Item name="currency" label={t('masters.defaultCurrency')} extra={t('masters.business.currencyHelp')}><CurrencySelect/></Form.Item><div className="master-form-grid"><Form.Item label={t('common.phone')} name="phone"><Input maxLength={40} /></Form.Item><Form.Item label={t('common.email')} name="email" rules={[{ type: 'email', transform: value => value?.trim() || undefined, message: t('masters.invalidEmail') }]}><Input maxLength={254} /></Form.Item><Form.Item label={t('masters.contactPerson')} name="contactName"><Input maxLength={160} /></Form.Item><Form.Item label={t('masters.taxReference')} name="taxReference"><Input maxLength={80} /></Form.Item></div><Form.Item label={t('common.address')} name="address"><Input.TextArea rows={2} maxLength={600} /></Form.Item></>}
 {kind === 'vendor' && <div className="master-form-grid"><Form.Item label={t('masters.business.vendorTypeOptional')} name="vendorType"><AutoComplete maxLength={80} placeholder={t('masters.business.vendorTypePlaceholder')} options={vendorTypes.map(key => ({ value: t('masters.business.vendorTypes.' + key) }))} /></Form.Item><Form.Item label={t('masters.business.agent')} name="isAgent" valuePropName="checked" extra={t('masters.business.agentHelp')}><Switch /></Form.Item></div>}
 {template
  ? <Form.Item label={t('masters.business.message')} name="notes" rules={[{ required: true, whitespace: true, max: 2000, message: t('masters.business.messageRequired') }]} extra={t('masters.business.placeholdersHelp', { placeholders: PLACEHOLDERS, link: '{{link}}' })}><Input.TextArea rows={5} maxLength={2000} /></Form.Item>
  : <Form.Item label={t('common.notes')} name="notes"><Input.TextArea rows={2} maxLength={2000} /></Form.Item>}<Form.Item label={t('common.active')} name="isActive" valuePropName="checked"><Switch /></Form.Item>
 {scopes.enabled && <Form.Item label={t('masters.business.availableIn')} name="availableIn" extra={t('masters.business.availableInHelp')}><Select options={[{ value: 'all', label: t('masters.business.allCompanies') }, { value: 'company', label: scopes.companyName ? t('masters.business.companyOnly', { company: scopes.companyName }) : t('masters.business.thisCompanyOnly') }]} /></Form.Item>}
 </Form></Modal></>
}


