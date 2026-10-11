import { CurrencyFields, useCurrencies, formatMoney } from '../currency'
import { useEffect, useRef, useState } from 'react'
import { ReceiptPicker, ReceiptsButton, uploadReceipts, useReceipts, type ReceiptKind } from '../expenseReceipts'
import { Button, Card, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tag, Tooltip, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, WalletOutlined } from '@ant-design/icons'
import type { SurveyExpense, SurveyExpenseInput } from '../types'
import { localNow, toLocal, when } from './TripClockCard'

type ExpenseForm = { category: string; amount: number; currency: string; exchangeRate?: number; incurredAtLocal: string; paidByEmployeeId?: string; notes: string }

export const expenseCategories: Record<string, { label: string; color: string }> = {
  FUEL: { label: 'Fuel / petrol', color: 'orange' }, TAXI: { label: 'Taxi / cab', color: 'gold' }, METRO: { label: 'Metro', color: 'blue' }, BUS: { label: 'Bus', color: 'cyan' },
  TOLL: { label: 'Toll', color: 'purple' }, PARKING: { label: 'Parking', color: 'geekblue' }, FOOD: { label: 'Food', color: 'green' }, OTHER: { label: 'Other', color: 'default' },
}
export const money = (amount: number) => amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Props = {
  categoryOptions?: { value: string; label: string }[]
  onOpen?: () => unknown
  title: string
  expenses: SurveyExpense[]
  totals: { currency: string; amount: number }[]
  employeeOptions: { value: string; label: string }[]
  defaultPaidBy: string | null
  emptyText: string
  onSave: (input: SurveyExpenseInput, existing: SurveyExpense | null) => Promise<void>
  onDelete: (expense: SurveyExpense) => Promise<void>
  /** When set, each expense can carry receipt photos/documents of this kind. */
  receiptKind?: ReceiptKind
}

/** Travel and out-of-pocket expenses (fuel, taxi, metro, bus, toll, parking…) with per-currency totals. */
export function ExpensesCard({ title, expenses, totals, employeeOptions, defaultPaidBy, emptyText, onSave, onDelete, categoryOptions, onOpen, receiptKind }: Props) {
  const [pending, setPending] = useState<File[]>([])
  const { byExpense, reload } = useReceipts(receiptKind ? expenses.map(x => x.id) : [])
  // Receipts picked while adding: uploaded once the new expense appears in the list (the parent refreshes it after saving).
  const awaiting = useRef<{ files: File[]; before: Set<string> } | null>(null)
  useEffect(() => {
    const a = awaiting.current; if (!a || !receiptKind) return
    const created = expenses.find(x => !a.before.has(x.id)); if (!created) return
    awaiting.current = null
    void uploadReceipts(receiptKind, created.id, a.files).then(n => { if (n) { message.success(n === 1 ? 'Receipt attached' : n + ' receipts attached'); void reload() } })
  }, [expenses])
  const [open, setOpen] = useState(false), [editing, setEditing] = useState<SurveyExpense | null>(null), [busy, setBusy] = useState(false)
  const {data:currencyData}=useCurrencies()
  const [form] = Form.useForm<ExpenseForm>()
  const show = (expense?: SurveyExpense) => {
    onOpen?.(); setEditing(expense ?? null); form.resetFields(); setPending([])
    form.setFieldsValue(expense
      ? { category: expense.category, amount: expense.amount, currency: expense.currency, incurredAtLocal: toLocal(expense.incurredAtUtc), paidByEmployeeId: expense.paidByEmployeeId ?? undefined, notes: expense.notes ?? '' }
      : { currency: expenses.at(-1)?.currency ?? currencyData?.settings.defaultCurrency ?? 'AED', incurredAtLocal: localNow(), paidByEmployeeId: defaultPaidBy ?? undefined, notes: '' })
    setOpen(true)
  }
  const save = async () => {
    const value = await form.validateFields()
    setBusy(true)
    if (!editing && pending.length && receiptKind) awaiting.current = { files: pending, before: new Set(expenses.map(x => x.id)) }
    try {
      await onSave({ category: value.category, amount: value.amount, currency: value.currency.trim().toUpperCase(), exchangeRate:value.exchangeRate, incurredAtUtc: new Date(value.incurredAtLocal).toISOString(), paidByEmployeeId: value.paidByEmployeeId ?? null, notes: value.notes ?? '' }, editing)
      setOpen(false); message.success(editing ? 'Expense updated' : 'Expense added')
    } catch (error) { awaiting.current = null; message.error(error instanceof Error ? error.message : 'Unable to save the expense') } finally { setBusy(false) }
  }
  const remove = async (expense: SurveyExpense) => { try { await onDelete(expense); message.success('Expense removed') } catch (error) { message.error(error instanceof Error ? error.message : 'Unable to remove the expense') } }

  return <Card className="survey-expenses-card" title={<Space><WalletOutlined />{title}</Space>} extra={<Space wrap>{totals.map(t => <Tag key={t.currency} className="survey-expense-total">{formatMoney(t.amount,t.currency)}</Tag>)}<Button icon={<PlusOutlined />} onClick={() => show()}>Add expense</Button></Space>}>
    {expenses.length ? <ul className="survey-expense-list">{expenses.map(x => <li key={x.id}>
      <Tag color={expenseCategories[x.category]?.color} className="survey-expense-category">{categoryOptions?.find(option => option.value === x.category)?.label ?? expenseCategories[x.category]?.label ?? x.category}</Tag>
      <div className="survey-expense-meta"><strong>{formatMoney(x.amount,x.currency)}</strong><small>{when(x.incurredAtUtc)}{x.paidByName ? ` · Paid by ${x.paidByName}` : ''}{x.notes ? ` · ${x.notes}` : ''}</small></div>
      <Space size={0}>{receiptKind && <ReceiptsButton kind={receiptKind} expenseId={x.id} receipts={byExpense.get(x.id) ?? []} onChanged={() => void reload()} title={'Receipts · ' + formatMoney(x.amount, x.currency)} />}<Tooltip title="Edit"><Button type="text" size="small" aria-label="Edit expense" icon={<EditOutlined />} onClick={() => show(x)} /></Tooltip>
        <Popconfirm title="Remove this expense?" okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => void remove(x)}><Button type="text" size="small" danger aria-label="Remove expense" icon={<DeleteOutlined />} /></Popconfirm></Space>
    </li>)}</ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />}

    <Modal centered width={860} open={open} title={editing ? 'Edit expense' : 'Add expense'} okText={editing ? 'Save expense' : 'Add expense'} confirmLoading={busy} onOk={() => void save()} onCancel={() => setOpen(false)} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark="optional">
        <div className="money-form-grid">
          <Form.Item label="Category" name="category" rules={[{ required: true, message: 'Choose a category' }]}><Select placeholder="Select category" options={categoryOptions ?? Object.entries(expenseCategories).map(([value, x]) => ({ value, label: x.label }))} /></Form.Item>
          <Form.Item label="Date and time" name="incurredAtLocal" rules={[{ required: true, message: 'Choose when it was paid' }]}><Input type="datetime-local" /></Form.Item>
          <Form.Item className="amount-field" label="Amount" name="amount" rules={[{ required: true, message: 'Enter the amount' }]}><InputNumber controls={false} min={0.01} max={10000000} precision={4} style={{ width: '100%' }} /></Form.Item>
          <CurrencyFields form={form} dateName="incurredAtLocal"/>
        </div>
        <Form.Item label="Paid by" name="paidByEmployeeId"><Select allowClear showSearch optionFilterProp="label" placeholder="Employee who paid" options={employeeOptions} /></Form.Item>
        <Form.Item label="Notes" name="notes"><Input.TextArea rows={2} maxLength={500} placeholder="Route, receipt number, vehicle…" /></Form.Item>
        {receiptKind && (editing ? <p className="receipt-hint">Add or view receipts with the paper-clip button next to the expense.</p>
          : <Form.Item label="Receipt (optional)" extra="Take a photo of the bill or attach a PDF; it is uploaded when you save."><ReceiptPicker value={pending} onChange={setPending} /></Form.Item>)}
      </Form>
    </Modal>
  </Card>
}




