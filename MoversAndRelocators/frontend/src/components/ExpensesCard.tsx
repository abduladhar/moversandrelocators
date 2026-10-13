import { CurrencyFields, useCurrencies, formatMoney } from '../currency'
import { useEffect, useRef, useState } from 'react'
import { ReceiptPicker, ReceiptsButton, uploadReceipts, useReceipts, type ReceiptKind } from '../expenseReceipts'
import { Button, Card, Empty, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Tag, Tooltip, message } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, WalletOutlined } from '@ant-design/icons'
import type { SurveyExpense, SurveyExpenseInput } from '../types'
import { localNow, toLocal, when } from './TripClockCard'
import { formatNumber, has, useT } from '../i18n'

type ExpenseForm = { category: string; amount: number; currency: string; exchangeRate?: number; incurredAtLocal: string; paidByEmployeeId?: string; notes: string }

/** Built-in categories; the label shown is expenses.categories.<code> in the user's language (label is the English fallback). */
export const expenseCategories: Record<string, { label: string; color: string }> = {
  FUEL: { label: 'Fuel / petrol', color: 'orange' }, TAXI: { label: 'Taxi / cab', color: 'gold' }, METRO: { label: 'Metro', color: 'blue' }, BUS: { label: 'Bus', color: 'cyan' },
  TOLL: { label: 'Toll', color: 'purple' }, PARKING: { label: 'Parking', color: 'geekblue' }, FOOD: { label: 'Food', color: 'green' }, OTHER: { label: 'Other', color: 'default' },
}
export const money = (amount: number) => formatNumber(amount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  const { t } = useT()
  const categoryLabel = (code: string) => has('expenses.categories.' + code) ? t('expenses.categories.' + code) : expenseCategories[code]?.label ?? code
  const { byExpense, reload } = useReceipts(receiptKind ? expenses.map(x => x.id) : [])
  // Receipts picked while adding: uploaded once the new expense appears in the list (the parent refreshes it after saving).
  const awaiting = useRef<{ files: File[]; before: Set<string> } | null>(null)
  useEffect(() => {
    const a = awaiting.current; if (!a || !receiptKind) return
    const created = expenses.find(x => !a.before.has(x.id)); if (!created) return
    awaiting.current = null
    void uploadReceipts(receiptKind, created.id, a.files).then(n => { if (n) { message.success(t('expenses.receipts.attached', { count: n })); void reload() } })
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
      setOpen(false); message.success(editing ? t('expenses.card.updated') : t('expenses.card.added'))
    } catch (error) { awaiting.current = null; message.error(error instanceof Error ? error.message : t('expenses.card.saveFailed')) } finally { setBusy(false) }
  }
  const remove = async (expense: SurveyExpense) => { try { await onDelete(expense); message.success(t('expenses.card.removed')) } catch (error) { message.error(error instanceof Error ? error.message : t('expenses.card.removeFailed')) } }

  return <Card className="survey-expenses-card" title={<Space><WalletOutlined />{title}</Space>} extra={<Space wrap>{totals.map(t => <Tag key={t.currency} className="survey-expense-total">{formatMoney(t.amount,t.currency)}</Tag>)}<Button icon={<PlusOutlined />} onClick={() => show()}>{t('expenses.card.add')}</Button></Space>}>
    {expenses.length ? <ul className="survey-expense-list">{expenses.map(x => <li key={x.id}>
      <Tag color={expenseCategories[x.category]?.color} className="survey-expense-category">{categoryOptions?.find(option => option.value === x.category)?.label ?? categoryLabel(x.category)}</Tag>
      <div className="survey-expense-meta"><strong>{formatMoney(x.amount,x.currency)}</strong><small>{when(x.incurredAtUtc)}{x.paidByName ? ` · ${t('expenses.card.paidByName', { name: x.paidByName })}` : ''}{x.notes ? ` · ${x.notes}` : ''}</small></div>
      <Space size={0}>{receiptKind && <ReceiptsButton kind={receiptKind} expenseId={x.id} receipts={byExpense.get(x.id) ?? []} onChanged={() => void reload()} title={t('expenses.receipts.titleFor', { label: formatMoney(x.amount, x.currency) })} />}<Tooltip title={t('common.edit')}><Button type="text" size="small" aria-label={t('expenses.card.edit')} icon={<EditOutlined />} onClick={() => show(x)} /></Tooltip>
        <Popconfirm title={t('expenses.card.removeTitle')} okText={t('common.remove')} cancelText={t('common.cancel')} okButtonProps={{ danger: true }} onConfirm={() => void remove(x)}><Button type="text" size="small" danger aria-label={t('expenses.card.remove')} icon={<DeleteOutlined />} /></Popconfirm></Space>
    </li>)}</ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />}

    <Modal centered width={860} open={open} title={editing ? t('expenses.card.edit') : t('expenses.card.add')} okText={editing ? t('expenses.card.save') : t('expenses.card.add')} cancelText={t('common.cancel')} confirmLoading={busy} onOk={() => void save()} onCancel={() => setOpen(false)} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark="optional">
        <div className="money-form-grid">
          <Form.Item label={t('expenses.card.category')} name="category" rules={[{ required: true, message: t('expenses.card.chooseCategory') }]}><Select placeholder={t('expenses.card.selectCategory')} options={categoryOptions ?? Object.keys(expenseCategories).map(value => ({ value, label: categoryLabel(value) }))} /></Form.Item>
          <Form.Item label={t('expenses.card.dateTime')} name="incurredAtLocal" rules={[{ required: true, message: t('expenses.card.chooseWhen') }]}><Input type="datetime-local" /></Form.Item>
          <Form.Item className="amount-field" label={t('common.amount')} name="amount" rules={[{ required: true, message: t('expenses.card.enterAmount') }]}><InputNumber controls={false} min={0.01} max={10000000} precision={4} style={{ width: '100%' }} /></Form.Item>
          <CurrencyFields form={form} dateName="incurredAtLocal"/>
        </div>
        <Form.Item label={t('expenses.card.paidBy')} name="paidByEmployeeId"><Select allowClear showSearch optionFilterProp="label" placeholder={t('expenses.card.employeeWhoPaid')} options={employeeOptions} /></Form.Item>
        <Form.Item label={t('common.notes')} name="notes"><Input.TextArea rows={2} maxLength={500} placeholder={t('expenses.card.notesPlaceholder')} /></Form.Item>
        {receiptKind && (editing ? <p className="receipt-hint">{t('expenses.card.receiptHint')}</p>
          : <Form.Item label={t('expenses.receipts.optionalLabel')} extra={t('expenses.receipts.optionalHelp')}><ReceiptPicker value={pending} onChange={setPending} /></Form.Item>)}
      </Form>
    </Modal>
  </Card>
}




