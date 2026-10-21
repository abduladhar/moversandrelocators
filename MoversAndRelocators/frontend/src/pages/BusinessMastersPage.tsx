import { CurrencySelect } from "../currency"
import { useState } from 'react'
import { AutoComplete, Button, Card, Form, Input, Modal, Select, Switch, Tag, message } from 'antd'
import { PageHeader } from '../components/PageHeader'
import { ResponsiveDataView } from '../components/ResponsiveDataView'
import type { ColumnsType } from 'antd/es/table'
import { useServerList, type ListParams } from '../hooks/useServerList'
import type { SortDirection } from '../utils/sortRecords'
import { RowActions } from '../components/RowActions'
import { AdvancedSearch } from '../components/AdvancedSearch'
import { businessMastersApi, type MasterKind, type BusinessMaster } from '../businessMasters'
import { useCompanyScopes } from '../companyScope'
import { useT } from '../i18n'
/** Translation keys under masters.business.kinds.<key>. */
const kindKeys: Record<MasterKind, string> = { 'crew-role': 'crewRole', 'payment-method': 'paymentMethod', 'payment-purpose': 'paymentPurpose', 'expense-category': 'expenseCategory', customer: 'customer', vendor: 'vendor', 'message-template': 'messageTemplate' }
/** Suggested vendor types (keys under masters.business.vendorTypes); the chosen text is saved as shown. */
const vendorTypes = ['transporter', 'shippingLine', 'airline', 'freightForwarder', 'customsBroker', 'warehouseProvider', 'packingSupplier', 'other']
/** Placeholders a message template may use; the screen that sends it supplies the values it knows. */
const PLACEHOLDERS = '{{customer}} · {{reference}} · {{link}} · {{date}} · {{amount}} · {{origin}} · {{destination}}'
/** The kind travels with the list params so a kind change refetches; it goes in the route, not the query string. */
const searchMasters = ({ kind, ...params }: ListParams) => businessMastersApi.search(kind as MasterKind, params)
export function BusinessMastersPage({ kind }: { kind: MasterKind }) {
 const { t } = useT()
 const kindText = (key: 'title' | 'add' | 'edit') => t(`masters.business.kinds.${kindKeys[kind]}.${key}`)
 const scopes = useCompanyScopes(kind === 'message-template' ? null : kind)
 const [query, setQuery] = useState(''), [active, setActive] = useState<boolean>(), [open, setOpen] = useState(false), [editing, setEditing] = useState<BusinessMaster>(), [saving, setSaving] = useState(false), [sortField, setSortField] = useState('name'), [sortDirection, setSortDirection] = useState<SortDirection>('asc')
 const list = useServerList(searchMasters, { kind, search: query, active, sort: sortField, desc: sortDirection === 'desc' })
 const reload = () => list.reload()
 const [form] = Form.useForm<BusinessMaster & { availableIn?: 'all' | 'company' }>()
 const contact = kind === 'customer' || kind === 'vendor'
 // A template belongs to the screen that sends it, so its code is fixed: the wording is what can be changed.
 const template = kind === 'message-template'
 const show = (row?: BusinessMaster) => { setEditing(row); form.resetFields(); form.setFieldsValue({ ...(row ?? { name: '', isActive: true }), availableIn: row && scopes.isCompanyOnly(row.code) ? 'company' : 'all' }); setOpen(true) }
 const save = async () => { const { availableIn, ...value } = await form.validateFields(); setSaving(true); try { const saved = await businessMastersApi.save(kind, value, editing?.code); if (scopes.enabled && (availableIn === 'company') !== scopes.isCompanyOnly(saved.code)) await scopes.set(saved.code, availableIn === 'company'); await reload(); setOpen(false); message.success(t('masters.business.saved')) } catch (e) { message.error(e instanceof Error ? e.message : t('masters.business.saveFailed')) } finally { setSaving(false) } }
 return <><PageHeader eyebrow={t('masters.business.eyebrow')} title={kindText('title')} description={template ? t('masters.business.templateDescription') : contact ? t('masters.business.contactDescription') : t('masters.business.choiceDescription')} onRefresh={reload} {...(template ? {} : { action: t('masters.business.addRecord'), onAction: () => show() })} filters={<AdvancedSearch value={query} onChange={setQuery} active={active !== undefined || sortField !== 'name' || sortDirection !== 'asc'} onReset={() => { setQuery(''); setActive(undefined); setSortField('name'); setSortDirection('asc') }} sortField={sortField} onSortField={setSortField} sortDirection={sortDirection} onSortDirection={setSortDirection} sortOptions={[{ value: 'name', label: t('common.name') }, { value: 'code', label: t('common.code') }]}><Select allowClear placeholder={t('common.status')} value={active} onChange={setActive} options={[{ value: true, label: t('common.active') }, { value: false, label: t('common.inactive') }]} /></AdvancedSearch>} />
 <Card className="grid-card" title={kindText('title')} extra={t('masters.records', { count: list.total })}><ResponsiveDataView<BusinessMaster> rowKey="code" data={list.rows} onScroll={list.onScroll} hasMore={list.hasMore} total={list.total} loading={list.loading} label={kindText('title')} scrollX={720} renderTile={row => <><div className="tile-heading"><div className="primary-cell"><strong>{row.name}</strong><small>{row.code}</small></div><Tag color={row.isActive ? 'green' : 'default'}>{row.isActive ? t('common.active') : t('common.inactive')}</Tag></div>{template ? <div className="tile-details"><span className="template-preview">{row.notes}</span></div> : contact && <div className="tile-details">{row.phone && <span>{row.phone}</span>}{row.email && <span>{row.email}</span>}{row.vendorType && <span>{row.vendorType}</span>}{row.isAgent && <Tag color="green">{t('masters.business.agent')}</Tag>}</div>}<div className="tile-actions"><RowActions><Button size="small" onClick={() => show(row)}>{t('common.edit')}</Button></RowActions></div></>} columns={[
 { title: t('common.code'), dataIndex: 'code' }, { title: t('common.name'), dataIndex: 'name' },
 ...(template ? [{ title: t('masters.business.message'), dataIndex: 'notes', render: (value: string) => <span className="template-preview">{value}</span> }] : []),
 ...(contact ? [{ title: t('common.phone'), dataIndex: 'phone' }, { title: t('common.email'), dataIndex: 'email' }, { title: t('masters.contactPerson'), dataIndex: 'contactName' }, { title: t('common.currency'), dataIndex: 'currency' }] : []),
 ...(kind === 'vendor' ? [{ title: t('masters.business.vendorType'), dataIndex: 'vendorType' }, { title: t('masters.business.agent'), dataIndex: 'isAgent', render: (value: boolean) => value ? <Tag color="green">{t('masters.business.agent')}</Tag> : '—' }] : []),
 ...scopes.column<BusinessMaster>(row => row.code),
 { title: t('common.status'), dataIndex: 'isActive', render: value => <Tag color={value ? 'green' : 'default'}>{value ? t('common.active') : t('common.inactive')}</Tag> },
 { title: t('common.actions'), key: 'actions', width: 80, render: (_, row) => <RowActions><Button onClick={() => show(row)}>{t('common.edit')}</Button></RowActions> },
 ] as ColumnsType<BusinessMaster>} /></Card>
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


