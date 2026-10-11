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

type Mode = 'labour' | 'expense' | 'report' | 'journal'
const fmt = (v: unknown) => typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v ?? '')
const localNow = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
export function OperationsCostsPage() {
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
  const fail = (e: unknown) => { const text = e instanceof Error ? e.message : 'Unable to complete action.'; setError(text); message.error(text) }
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
    form.setFieldsValue(report ? { ...report, name: clone ? report.name + ' copy' : report.name, version: clone ? undefined : report.version } :
      { currency: currencyData?.settings.defaultCurrency, activity: 'PACKING', unpaidBreakMinutes: 0, overtimeHours: 0, hourlyRate: 0, overtimeRate: 0, startedAtUtc: localNow(), endedAtUtc: localNow(), postingDate: new Date().toISOString().slice(0, 10), columns: ['pickupNumber', 'customerName', 'currency', 'labourCost', 'materialCost', 'fuelCost', 'vendorCost', 'totalCost'], sortBy: 'pickupNumber' })
  }
  const submit = async (v: Record<string, unknown>) => {
    setSaving(true)
    try {
      if (mode === 'labour') await operationsApi.saveLabour({ ...v, requestId, startedAtUtc: new Date(String(v.startedAtUtc)).toISOString(), endedAtUtc: new Date(String(v.endedAtUtc)).toISOString() })
      if (mode === 'expense') {
        const saved = await operationsApi.saveExpense({ ...v, requestId })
        if (pendingReceipts.length && saved?.id) { const n = await uploadReceipts('OPERATIONS', saved.id, pendingReceipts); if (n) message.success(n === 1 ? 'Receipt attached' : n + ' receipts attached') }
      }
      if (mode === 'report') await operationsApi.saveReport(v, reportId)
      if (mode === 'journal') await operationsApi.journal({ ...v, requestId, pickupId: v.pickupId || null, lines: [{ accountCode: v.debitAccount, debit: v.amount, credit: 0 }, { accountCode: v.creditAccount, debit: 0, credit: v.amount }] })
      setMode(null); message.success('Saved'); await load()
    } catch (e) { fail(e) } finally { setSaving(false) }
  }
  const pickupField = <Form.Item name="pickupId" label="Move / pickup" rules={mode === 'journal' ? [] : [{ required: true }]}><Select showSearch optionFilterProp="label" allowClear options={pickups.map(p => ({ value: p.id, label: p.pickupNumber + ' · ' + p.customerName }))} /></Form.Item>
  const moneyField = (name: string, label: string, required = true) => <Form.Item className={/amount|cost|rate|price/i.test(name) ? "amount-field" : undefined} name={name} label={label} rules={required ? [{ required: true }] : []}><InputNumber controls={false} min={0} max={1000000000} precision={4} style={{ width: '100%' }} /></Form.Item>
  const currencyField = <CurrencyFields form={form} dateName={mode==="journal"?"postingDate":mode==="labour"?"startedAtUtc":"date"}/>
  const cols = (keys: string[]) => keys.map(key => ({ title: readable(key), dataIndex: key, key, render: fmt }))
  const reportRows = preview ? [...costs].sort((a, b) => typeof a[preview.sortBy] === 'number' ? Number(a[preview.sortBy]) - Number(b[preview.sortBy]) : String(a[preview.sortBy]).localeCompare(String(b[preview.sortBy]))) : []
  return <div className="operations-workspace">
    <PageHeader onRefresh={load} eyebrow="OPERATIONS" title="Costs & finance" description="See who worked, what the move cost, and where money went." />
    {error && <Alert type="error" message={error} closable onClose={() => setError('')} />}
    <Space wrap style={{marginBottom:16}}><Select aria-label="Cost report currency" value={reportMode} onChange={setReportMode} options={[{value:"TRANSACTION",label:"Transaction currencies"},{value:"BASE",label:"Base currency · "+(currencyData?.baseCurrency||"…")},{value:"PARTY",label:"Customer currency"}]}/><Input type="date" aria-label="Report conversion date" value={reportDate} onChange={e=>setReportDate(e.target.value)}/></Space><Tabs items={[
      { key: 'costs', label: 'Move costs', children: <><Alert type="info" showIcon message="Recorded income is shown separately from formal ledger revenue. Material usage, labour and completed-trip fuel are included automatically. Record each expense only once." /><div className="cost-cards">{costs.map(c => <Card key={c.pickupId+c.currency} title={c.pickupNumber}><Typography.Text>{c.customerName}</Typography.Text><div className="cost-value">{c.currency} {fmt(c.totalCost)}</div><span>Total recorded cost · {fmt(c.labourHours)} person-hours</span><dl>{['labourCost', 'materialCost', 'fuelCost', 'vendorCost'].map(k => <div key={k}><dt>{readable(k)}</dt><dd>{fmt(c[k])}</dd></div>)}</dl></Card>)}</div><Table className="desktop-cost-table" rowKey={r=>r.pickupId+r.currency} loading={busy} dataSource={costs} columns={cols(['pickupNumber', 'customerName', 'currency', 'recordedIncome', 'labourHours', 'labourCost', 'materialCost', 'fuelCost', 'transportOtherCost', 'vendorCost', 'otherExpense', 'legacyExpense', 'totalCost', 'recordedSurplus'])} scroll={{ x: 1750 }} /></> },
      { key: 'labour', label: 'Work hours', children: <><Button type="primary" onClick={() => open('labour')}>Record work hours</Button><Table rowKey="id" dataSource={labour} columns={[{ title: 'Move', render: (_, r) => pickups.find(p => p.id === r.pickupId)?.pickupNumber }, ...cols(['employeeName', 'activity', 'regularHours', 'overtimeHours', 'hourlyRate', 'currency', 'cost'])]} scroll={{ x: 950 }} /></> },
      { key: 'expenses', label: 'Vendor & other expenses', children: <><Button type="primary" onClick={() => open('expense')}>Record expense</Button><Table rowKey="id" dataSource={expenses} columns={[{ title: 'Move', render: (_, r) => pickups.find(p => p.id === r.pickupId)?.pickupNumber }, ...cols(['category', 'vendor', 'reference', 'currency', 'amount']), { title: 'Receipts', width: 90, render: (_: unknown, r: Expense) => <ReceiptsButton kind="OPERATIONS" expenseId={r.id} receipts={receipts.byExpense.get(r.id) ?? []} onChanged={() => void receipts.reload()} title={'Receipts · ' + (r.vendor || r.category)} /> }]} scroll={{ x: 750 }} /></> },
      { key: 'reports', label: 'My reports', children: <><Button type="primary" onClick={() => open('report')}>Create from cost template</Button><div className="report-cards">{reports.map(r => <Card key={r.id} title={r.name}><p>{r.columns.map(readable).join(' · ')}</p><RowActions><Space wrap><Button onClick={() => setPreview(r)}>Preview / print</Button><Button onClick={() => open('report', r)}>Edit</Button><Button onClick={() => open('report', r, true)}>Make a copy</Button><Button onClick={() => operationsApi.exportReport(r.id,reportMode,reportDate).catch(fail)}>Download CSV</Button></Space></RowActions></Card>)}</div></> },
      { key: 'ledger', label: 'Ledger', children: <><Space wrap><Button type="primary" onClick={() => open('journal')}>Post balanced entry</Button><Button onClick={()=>setCurrency("BASE")}>Consolidated {currencyData?.baseCurrency}</Button><Input aria-label="Trial balance currency" value={currency} maxLength={3} onChange={e => { if (/^[A-Za-z]{3}$/.test(e.target.value)) setCurrency(e.target.value.toUpperCase()) }} style={{ width: 90 }} /></Space><Typography.Title level={4}>Trial balance · {currency==="BASE"?currencyData?.baseCurrency:currency}</Typography.Title><Table rowKey="code" dataSource={balance} columns={cols(['code', 'name', 'debit', 'credit', 'balance'])} pagination={false} scroll={{ x: 650 }} /><Typography.Title level={4}>Posted entries</Typography.Title><Table rowKey={j => j.entry.id} dataSource={journals} columns={[{ title: 'Reference', render: (_, j) => j.entry.reference }, { title: 'Date', render: (_, j) => j.entry.postingDate }, { title: 'Description', render: (_, j) => j.entry.description }, { title: 'Amount', render: (_, j) => j.entry.currency + ' ' + fmt(j.lines.reduce((n, l) => n + l.debit, 0)) }, { title: 'Action', render: (_, j) => <Popconfirm title="Post an equal reversal today?" onConfirm={() => operationsApi.reverse(j.entry.id, { requestId: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10) }).then(load).catch(fail)}><Button disabled={journals.some(x => x.entry.reversesId === j.entry.id)}>Reverse</Button></Popconfirm> }]} scroll={{ x: 800 }} /></> },
    ]} />
    <Modal centered title={mode ? ({ labour: 'Record employee work', expense: 'Record vendor or other expense', report: 'Design your cost report', journal: 'Post balanced ledger entry' }[mode]) : ''} open={!!mode} onCancel={() => !saving && setMode(null)} onOk={() => form.submit()} confirmLoading={saving} width={720} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} className="operations-form">
        {(mode === 'labour' || mode === 'expense' || mode === 'journal') && <>{pickupField}{currencyField}</>}
        {mode === 'labour' && <><Form.Item name="employeeId" label="Who did the work?" rules={[{ required: true }]}><Select showSearch optionFilterProp="label" options={employees.filter(e => e.isActive).map(e => ({ value: e.id, label: e.fullName }))} /></Form.Item><Form.Item name="activity" label="Work type" rules={[{ required: true }]}><Select options={catalogue.activities.map(value => ({ value, label: readable(value) }))} /></Form.Item><Form.Item name="startedAtUtc" label="Started (your local time)" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item><Form.Item name="endedAtUtc" label="Finished (your local time)" rules={[{ required: true }]}><Input type="datetime-local" /></Form.Item>{moneyField('unpaidBreakMinutes', 'Unpaid break in minutes')}{moneyField('overtimeHours', 'Overtime hours')}{moneyField('hourlyRate', 'Loaded regular cost per hour')}{moneyField('overtimeRate', 'Loaded overtime cost per hour')}<Form.Item name="notes" label="Notes"><Input.TextArea maxLength={1000} /></Form.Item></>}
        {mode === 'expense' && <><Form.Item name="category" label="Expense type" rules={[{ required: true }]}><Select options={catalogue.expenseCategories.map(value => ({ value, label: readable(value) }))} /></Form.Item><ContactMasterPicker kind="vendor" onSelect={v => form.setFieldValue('vendor', v.name)} /><Form.Item name="vendor" label="Vendor / person paid" rules={[{ required: true }]}><Input maxLength={160} /></Form.Item><Form.Item name="reference" label="Bill / receipt reference" rules={[{ required: true }]}><Input maxLength={120} /></Form.Item>{moneyField('amount', 'Expense amount')}<Form.Item name="notes" label="Notes"><Input.TextArea maxLength={1000} /></Form.Item></>}
        {mode === 'expense' && <Form.Item label="Receipt (optional)" extra="Take a photo of the bill or attach the vendor invoice; it is uploaded when you save."><ReceiptPicker value={pendingReceipts} onChange={setPendingReceipts} /></Form.Item>}
        {mode === 'report' && <><Form.Item name="name" label="Report name" rules={[{ required: true }]}><Input maxLength={160} /></Form.Item><Form.Item name="columns" label="Columns, in selection order" rules={[{ required: true }]}><Select mode="multiple" options={catalogue.reportColumns.map(value => ({ value, label: readable(value) }))} /></Form.Item><Form.Item name="sortBy" label="Sort by" rules={[{ required: true }]}><Select options={catalogue.reportColumns.map(value => ({ value, label: readable(value) }))} /></Form.Item><Form.Item name="version" hidden><Input /></Form.Item></>}
        {mode === 'journal' && <><Form.Item name="reference" label="Document reference" rules={[{ required: true }]}><Input maxLength={120} /></Form.Item><Form.Item name="description" label="What is this entry for?" rules={[{ required: true }]}><Input maxLength={1000} /></Form.Item><Form.Item name="postingDate" label="Posting date" rules={[{ required: true }]}><Input type="date" /></Form.Item>{moneyField('amount', 'Amount')}{['debitAccount', 'creditAccount'].map(k => <Form.Item key={k} name={k} label={readable(k)} rules={[{ required: true }]}><Select options={catalogue.accounts.map(a => ({ value: a.code, label: a.code + ' · ' + a.name }))} /></Form.Item>)}</>}
      </Form>
    </Modal>
    <Modal centered open={!!preview} title={preview?.name} onCancel={() => setPreview(null)} width="95%" footer={<ReportPrintButton type="COST_REPORT" title={preview?.name??"Cost report"} id={preview?.id} query={{mode:reportMode,date:reportDate}} disabled={!preview}/>}><div className="printable-report"><Typography.Title level={3}>{preview?.name}</Typography.Title><Table rowKey={r=>r.pickupId+r.currency} dataSource={reportRows} columns={cols(preview?.columns ?? [])} pagination={false} scroll={{ x: true }} /></div></Modal>
  </div>
}







