import { todayLocal } from '../dates'
import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import { ReceiptPicker, ReceiptsButton, uploadReceipts, useReceipts } from '../expenseReceipts'
import {CurrencyFields,useCurrencies,localDate} from '../currency'
import { ContactMasterPicker } from '../components/ContactMasterPicker'
import { DataGrid as Table } from '../components/DataGrid'
import { RowActions } from '../components/RowActions'
import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tabs, Typography, message } from 'antd'
import { PageHeader } from '../components/PageHeader'
import { operationsApi, readable, type Balance, type Catalogue, type CostRow, type Expense, type Journal, type LabourEntry, type Report } from '../operationsApi'
import type { EmployeeChoice, PickupChoice } from '../operationsApi'
import { formatNumber, has, useT } from '../i18n'

type Mode = 'labour' | 'expense' | 'report' | 'journal'
const fmt = (v: unknown) => typeof v === 'number' ? formatNumber(v, { maximumFractionDigits: 2 }) : String(v ?? '')
const localNow = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
export function OperationsCostsPage() {
  const { t } = useT()
  /** Displayed label for a code; codes without a text show in readable English. */
  const label = (prefix: string, value: string) => has('operations.costs.' + prefix + '.' + value) ? t('operations.costs.' + prefix + '.' + value) : readable(value)
  const fieldLabel = (key: string) => label('field', key)
  const activityLabel = (v: string) => label('activity', v), categoryLabel = (v: string) => label('expenseCategory', v)
  const {data:currencyData}=useCurrencies(),[reportMode,setReportMode]=useState('TRANSACTION'),[reportDate,setReportDate]=useState(localDate())
  const [costs, setCosts] = useState<CostRow[]>([]), [labour, setLabour] = useState<LabourEntry[]>([]), [expenses, setExpenses] = useState<Expense[]>([])
  const [pendingReceipts, setPendingReceipts] = useState<File[]>([])
  const receipts = useReceipts(expenses.map(x => x.id))
  const [reports, setReports] = useState<Report[]>([]), [journals, setJournals] = useState<Journal[]>([]), [balance, setBalance] = useState<Balance[]>([])
  const [pickups, setPickups] = useState<PickupChoice[]>([]), [employees, setEmployees] = useState<EmployeeChoice[]>([])
  const [catalogue, setCatalogue] = useState<Catalogue>({ activities: [], expenseCategories: [], reportColumns: [], accounts: [] })
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<Mode | null>(null), [reportId, setReportId] = useState<string>(), [preview, setPreview] = useState<Report | null>(null)
  const [currency, setCurrency] = useState(''), [requestId, setRequestId] = useState(''), [form] = Form.useForm()
  const fail = (e: unknown) => { const text = e instanceof Error ? e.message : t('operations.costs.actionFailed'); setError(text); message.error(text) }
  const load = async () => {
    setBusy(true)
    try {
      const [c, l, e, r, j, cat, choices] = await Promise.all([operationsApi.costs(reportMode,reportDate), operationsApi.labour(), operationsApi.expenses(), operationsApi.reports(), operationsApi.journals(), operationsApi.catalogue(), operationsApi.choices()])
      setCosts(c); setLabour(l); setExpenses(e); setReports(r); setJournals(j); setCatalogue(cat); setPickups(choices.pickups); setEmployees(choices.employees); setError('')
    } catch (e) { fail(e) } finally { setBusy(false) }
  }
  useEffect(() => { void load() }, [reportMode,reportDate])
  // The ledger opens in the tenant's default transaction currency once currency settings load.
  useEffect(() => { if (!currency && currencyData) setCurrency(currencyData.settings.defaultCurrency) }, [currencyData])
  useEffect(() => { if (currency) operationsApi.balance(currency).then(setBalance).catch(fail) }, [currency, journals])
  const open = (next: Mode, report?: Report, clone = false) => {
    setPendingReceipts([])
    setMode(next); setReportId(clone ? undefined : report?.id); setRequestId(crypto.randomUUID()); form.resetFields()
    form.setFieldsValue(report ? { ...report, name: clone ? t('operations.costs.copyName', { name: report.name }) : report.name, version: clone ? undefined : report.version } :
      { currency: currencyData?.settings.defaultCurrency, activity: 'PACKING', unpaidBreakMinutes: 0, overtimeHours: 0, hourlyRate: 0, overtimeRate: 0, startedAtUtc: localNow(), endedAtUtc: localNow(), postingDate: todayLocal(), columns: ['pickupNumber', 'customerName', 'currency', 'labourCost', 'materialCost', 'fuelCost', 'vendorCost', 'totalCost'], sortBy: 'pickupNumber' })
  }
  const submit = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (mode === 'labour') await operationsApi.saveLabour({ ...v, requestId, startedAtUtc: new Date(String(v.startedAtUtc)).toISOString(), endedAtUtc: new Date(String(v.endedAtUtc)).toISOString() })
      if (mode === 'expense') {
        const saved = await operationsApi.saveExpense({ ...v, requestId })
        if (pendingReceipts.length && saved?.id) { const n = await uploadReceipts('OPERATIONS', saved.id, pendingReceipts); if (n) message.success(t('operations.costs.receiptsAttached', { count: n })) }
      }
      if (mode === 'report') await operationsApi.saveReport(v, reportId)
      if (mode === 'journal') await operationsApi.journal({ ...v, requestId, pickupId: v.pickupId || null, lines: [{ accountCode: v.debitAccount, debit: v.amount, credit: 0 }, { accountCode: v.creditAccount, debit: 0, credit: v.amount }] })
      setMode(null); message.success(t('common.saved')); await load()
    } catch (e) { fail(e) } finally { setSaving(false) }
  }
  const required = [{ required: true, message: t('common.required') }]
  const pickupField = <Form.Item name="pickupId" label={t('operations.costs.pickup')} rules={mode === 'journal' ? [] : required}><Select showSearch optionFilterProp="label" allowClear options={pickups.map(p => ({ value: p.id, label: p.pickupNumber + ' · ' + p.customerName }))} /></Form.Item>
  const moneyField = (name: string, label: string, isRequired = true) => <Form.Item className={/amount|cost|rate|price/i.test(name) ? "amount-field" : undefined} name={name} label={label} rules={isRequired ? required : []}><InputNumber controls={false} min={0} max={1000000000} precision={4} style={{ width: '100%' }} /></Form.Item>
  const currencyField = <CurrencyFields form={form} dateName={mode==="journal"?"postingDate":mode==="labour"?"startedAtUtc":"date"}/>
  const render = (key: string) => key === 'activity' ? (v: unknown) => activityLabel(String(v ?? '')) : key === 'category' ? (v: unknown) => categoryLabel(String(v ?? '')) : fmt
  const cols = (keys: string[]) => keys.map(key => ({ title: fieldLabel(key), dataIndex: key, key, render: render(key) }))
  const reportRows = preview ? [...costs].sort((a, b) => typeof a[preview.sortBy] === 'number' ? Number(a[preview.sortBy]) - Number(b[preview.sortBy]) : String(a[preview.sortBy]).localeCompare(String(b[preview.sortBy]))) : []
  const columnOptions = catalogue.reportColumns.map(value => ({ value, label: fieldLabel(value) }))
  return <div className="operations-workspace">
    <PageHeader onRefresh={load} eyebrow={t('operations.costs.eyebrow')} title={t('operations.costs.title')} description={t('operations.costs.description')} />
    {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
    <Space wrap style={{marginBottom:16}}><Select aria-label={t('operations.costs.reportCurrency')} value={reportMode} onChange={setReportMode} options={[{value:"TRANSACTION",label:t('operations.costs.transactionCurrencies')},{value:"BASE",label:t('operations.costs.baseCurrency',{currency:currencyData?.baseCurrency||"…"})},{value:"PARTY",label:t('operations.costs.customerCurrency')}]}/><Input type="date" aria-label={t('operations.costs.conversionDate')} value={reportDate} onChange={e=>setReportDate(e.target.value)}/></Space><Tabs items={[
      { key: 'costs', label: t('operations.costs.tab.costs'), children: <><Alert type="info" showIcon message={t('operations.costs.costsHint')} /><div className="cost-cards">{costs.map(c => <Card key={c.pickupId+c.currency} title={c.pickupNumber}><Typography.Text>{c.customerName}</Typography.Text><div className="cost-value">{c.currency} {fmt(c.totalCost)}</div><span>{t('operations.costs.totalCost', { hours: fmt(c.labourHours) })}</span><dl>{['labourCost', 'materialCost', 'fuelCost', 'vendorCost'].map(k => <div key={k}><dt>{fieldLabel(k)}</dt><dd>{fmt(c[k])}</dd></div>)}</dl></Card>)}</div><Table className="desktop-cost-table" rowKey={r=>r.pickupId+r.currency} loading={busy} dataSource={costs} columns={cols(['pickupNumber', 'customerName', 'currency', 'recordedIncome', 'labourHours', 'labourCost', 'materialCost', 'fuelCost', 'transportOtherCost', 'vendorCost', 'otherExpense', 'legacyExpense', 'totalCost', 'recordedSurplus'])} scroll={{ x: 1750 }} /></> },
      { key: 'labour', label: t('operations.costs.tab.labour'), children: <><Button type="primary" onClick={() => open('labour')}>{t('operations.costs.recordHours')}</Button><Table rowKey="id" dataSource={labour} columns={[{ title: t('operations.costs.move'), render: (_, r) => pickups.find(p => p.id === r.pickupId)?.pickupNumber }, ...cols(['employeeName', 'activity', 'regularHours', 'overtimeHours', 'hourlyRate', 'currency', 'cost'])]} scroll={{ x: 950 }} /></> },
      { key: 'expenses', label: t('operations.costs.tab.expenses'), children: <><Button type="primary" onClick={() => open('expense')}>{t('operations.costs.recordExpense')}</Button><Table rowKey="id" dataSource={expenses} columns={[{ title: t('operations.costs.move'), render: (_, r) => pickups.find(p => p.id === r.pickupId)?.pickupNumber }, ...cols(['category', 'vendor', 'reference', 'currency', 'amount']), { title: t('operations.costs.receipts'), width: 90, render: (_: unknown, r: Expense) => <ReceiptsButton kind="OPERATIONS" expenseId={r.id} receipts={receipts.byExpense.get(r.id) ?? []} onChanged={() => void receipts.reload()} title={t('operations.costs.receiptsTitle', { name: r.vendor || categoryLabel(r.category) })} /> }]} scroll={{ x: 750 }} /></> },
      { key: 'reports', label: t('operations.costs.tab.reports'), children: <><Button type="primary" onClick={() => open('report')}>{t('operations.costs.createReport')}</Button><div className="report-cards">{reports.map(r => <Card key={r.id} title={r.name}><p>{r.columns.map(fieldLabel).join(' · ')}</p><RowActions><Space wrap><Button onClick={() => setPreview(r)}>{t('operations.costs.preview')}</Button><Button onClick={() => open('report', r)}>{t('common.edit')}</Button><Button onClick={() => open('report', r, true)}>{t('operations.costs.makeCopy')}</Button><Button onClick={() => operationsApi.exportReport(r.id,reportMode,reportDate).catch(fail)}>{t('operations.costs.downloadCsv')}</Button></Space></RowActions></Card>)}</div></> },
      { key: 'ledger', label: t('operations.costs.tab.ledger'), children: <><Space wrap><Button type="primary" onClick={() => open('journal')}>{t('operations.costs.postEntry')}</Button><Button onClick={()=>setCurrency("BASE")}>{t('operations.costs.consolidated', { currency: currencyData?.baseCurrency ?? '' })}</Button><Input aria-label={t('operations.costs.trialCurrency')} value={currency} maxLength={3} onChange={e => { if (/^[A-Za-z]{3}$/.test(e.target.value)) setCurrency(e.target.value.toUpperCase()) }} style={{ width: 90 }} /></Space><Typography.Title level={4}>{t('operations.costs.trialBalance', { currency: (currency==="BASE"?currencyData?.baseCurrency:currency) ?? '' })}</Typography.Title><Table rowKey="code" dataSource={balance} columns={cols(['code', 'name', 'debit', 'credit', 'balance'])} pagination={false} scroll={{ x: 650 }} /><Typography.Title level={4}>{t('operations.costs.postedEntries')}</Typography.Title><Table rowKey={j => j.entry.id} dataSource={journals} columns={[{ title: t('operations.costs.reference'), render: (_, j) => j.entry.reference }, { title: t('common.date'), render: (_, j) => j.entry.postingDate }, { title: t('common.description'), render: (_, j) => j.entry.description }, { title: t('common.amount'), render: (_, j) => j.entry.currency + ' ' + fmt(j.lines.reduce((n, l) => n + l.debit, 0)) }, { title: t('operations.costs.action'), render: (_, j) => <Popconfirm title={t('operations.costs.reverseTitle')} okText={t('common.yes')} cancelText={t('common.no')} onConfirm={() => operationsApi.reverse(j.entry.id, { requestId: crypto.randomUUID(), date: todayLocal() }).then(load).catch(fail)}><Button disabled={journals.some(x => x.entry.reversesId === j.entry.id)}>{t('operations.costs.reverse')}</Button></Popconfirm> }]} scroll={{ x: 800 }} /></> },
    ]} />
    <Modal centered title={mode ? t('operations.costs.modal.' + mode) : ''} open={!!mode} onCancel={() => !saving && setMode(null)} onOk={() => form.submit()} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} width={720} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} className="operations-form">
        {(mode === 'labour' || mode === 'expense' || mode === 'journal') && <>{pickupField}{currencyField}</>}
        {mode === 'labour' && <><Form.Item name="employeeId" label={t('operations.costs.whoWorked')} rules={required}><Select showSearch optionFilterProp="label" options={employees.filter(e => e.isActive).map(e => ({ value: e.id, label: e.fullName }))} /></Form.Item><Form.Item name="activity" label={t('operations.costs.workType')} rules={required}><Select options={catalogue.activities.map(value => ({ value, label: activityLabel(value) }))} /></Form.Item><Form.Item name="startedAtUtc" label={t('operations.costs.started')} rules={required}><Input type="datetime-local" /></Form.Item><Form.Item name="endedAtUtc" label={t('operations.costs.finished')} rules={required}><Input type="datetime-local" /></Form.Item>{moneyField('unpaidBreakMinutes', t('operations.costs.unpaidBreak'))}{moneyField('overtimeHours', t('operations.costs.overtimeHours'))}{moneyField('hourlyRate', t('operations.costs.regularRate'))}{moneyField('overtimeRate', t('operations.costs.overtimeRate'))}<Form.Item name="notes" label={t('common.notes')}><Input.TextArea maxLength={1000} /></Form.Item></>}
        {mode === 'expense' && <><Form.Item name="category" label={t('operations.costs.expenseType')} rules={required}><Select options={catalogue.expenseCategories.map(value => ({ value, label: categoryLabel(value) }))} /></Form.Item><ContactMasterPicker kind="vendor" onSelect={v => form.setFieldValue('vendor', v.name)} /><Form.Item name="vendor" label={t('operations.costs.vendorPaid')} rules={required}><Input maxLength={160} /></Form.Item><Form.Item name="reference" label={t('operations.costs.billReference')} rules={required}><Input maxLength={120} /></Form.Item>{moneyField('amount', t('operations.costs.expenseAmount'))}<Form.Item name="notes" label={t('common.notes')}><Input.TextArea maxLength={1000} /></Form.Item></>}
        {mode === 'expense' && <Form.Item label={t('operations.costs.receiptOptional')} extra={t('operations.costs.receiptExtra')}><ReceiptPicker value={pendingReceipts} onChange={setPendingReceipts} /></Form.Item>}
        {mode === 'report' && <><Form.Item name="name" label={t('operations.costs.reportName')} rules={required}><Input maxLength={160} /></Form.Item><Form.Item name="columns" label={t('operations.costs.columns')} rules={required}><Select mode="multiple" options={columnOptions} /></Form.Item><Form.Item name="sortBy" label={t('operations.costs.sortBy')} rules={required}><Select options={columnOptions} /></Form.Item><Form.Item name="version" hidden><Input /></Form.Item></>}
        {mode === 'journal' && <><Form.Item name="reference" label={t('operations.costs.documentReference')} rules={required}><Input maxLength={120} /></Form.Item><Form.Item name="description" label={t('operations.costs.entryFor')} rules={required}><Input maxLength={1000} /></Form.Item><Form.Item name="postingDate" label={t('operations.costs.postingDate')} rules={required}><Input type="date" /></Form.Item>{moneyField('amount', t('common.amount'))}{['debitAccount', 'creditAccount'].map(k => <Form.Item key={k} name={k} label={fieldLabel(k)} rules={required}><Select options={catalogue.accounts.map(a => ({ value: a.code, label: a.code + ' · ' + a.name }))} /></Form.Item>)}</>}
      </Form>
    </Modal>
    <Modal centered open={!!preview} title={preview?.name} onCancel={() => setPreview(null)} width="95%" footer={<ReportPrintButton type="COST_REPORT" title={preview?.name??t('operations.costs.costReport')} id={preview?.id} query={{mode:reportMode,date:reportDate}} disabled={!preview}/>}><div className="printable-report"><Typography.Title level={3}>{preview?.name}</Typography.Title><Table rowKey={r=>r.pickupId+r.currency} dataSource={reportRows} columns={cols(preview?.columns ?? [])} pagination={false} scroll={{ x: true }} /></div></Modal>
  </div>
}
