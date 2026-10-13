import { CurrencyFields, formatMoney, useCurrencies } from '../../currency'
import { useBusinessMasters } from '../../businessMasters'
import { useState } from 'react'
import { AutoComplete, Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Tag, message } from 'antd'
import { DollarOutlined, PlusOutlined, PrinterOutlined } from '@ant-design/icons'
import { pickupsApi } from '../../api'
import type { Employee, PickupDetail, PickupWork } from '../../types'
import { ExpensesCard, money } from '../ExpensesCard'
import { ReceiptsButton, useReceipts } from '../../expenseReceipts'
import { when } from '../TripClockCard'
import { useT } from '../../i18n'

type Transaction = PickupDetail['transactions'][number]
type PaymentForm = {currency?:string;exchangeRate?:number; amount: number; paymentMethod: string; category: string; notes: string }

type Props = { detail: PickupDetail; work: PickupWork; employees: Employee[]; currency: string; onDetail: (detail: PickupDetail) => void; onWork: (work: PickupWork) => void; onReceipt: (payment: Transaction) => void }

/** Amounts collected from the customer (with printable receipts) and crew expenses for the pickup. */
export function PickupPaymentsTab({ detail, work, employees, currency, onDetail, onWork, onReceipt }: Props) {
  const {data:currencyData}=useCurrencies()
  const { t } = useT()
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [form] = Form.useForm<PaymentForm>()
  const { rows: methodMasters, reload: reloadMethods } = useBusinessMasters('payment-method')
  const { rows: purposeMasters, reload: reloadPurposes } = useBusinessMasters('payment-purpose')
  const { rows: expenseMasters, reload: reloadExpenses } = useBusinessMasters('expense-category')
  const methods = methodMasters.filter(x => x.isActive).map(x => ({ value: x.code, label: x.name }))
  const paymentPurposes = purposeMasters.filter(x => x.isActive).map(x => x.name)
  const pickupId = detail.pickup.id
  const payments = detail.transactions.filter(x => x.type === 'INCOME'), earlierExpenses = detail.transactions.filter(x => x.type === 'EXPENSE')
  const earlierReceipts = useReceipts(earlierExpenses.map(x => x.id))
  const employeeOptions = employees.filter(x => x.isActive).map(x => ({ value: x.id, label: `${x.fullName} · ${x.employeeNumber}` }))
  const crewLead = detail.assignments.find(a => /lead/i.test(a.role))?.employeeId ?? detail.assignments[0]?.employeeId ?? null

  const record = async () => {
    const v = await form.validateFields(); setBusy(true)
    try {
      const updated = await pickupsApi.addTransaction(pickupId, { type: 'INCOME', currency:v.currency,exchangeRate:v.exchangeRate, category: v.category, amount: v.amount, paymentMethod: v.paymentMethod, notes: v.notes })
      onDetail(updated); setOpen(false); message.success(t('pickups.payments.recorded'))
      const latest = updated.transactions.filter(x => x.type === 'INCOME').sort((a, b) => b.serialNo - a.serialNo)[0]
      if (latest) onReceipt(latest)
    } catch (e) { message.error(e instanceof Error ? e.message : t('pickups.payments.recordFailed')) } finally { setBusy(false) }
  }

  return <div className="pickup-tab-grid">
    <Card title={<Space><DollarOutlined />{t('pickups.payments.customerReceipts')}</Space>} extra={<Space wrap><Tag className="survey-expense-total">{t('pickups.payments.receiptCount', { count: payments.length })}</Tag>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => { void reloadMethods(); void reloadPurposes(); form.resetFields(); form.setFieldsValue({ currency:currencyData?.settings.defaultCurrency, paymentMethod: methods.find(x => x.value === 'CASH')?.value ?? methods[0]?.value, category: purposeMasters.find(x => x.isActive && x.code === (payments.length ? 'BALANCE' : 'ADVANCE'))?.name ?? paymentPurposes[0], notes: '' }); setOpen(true) }}>{t('pickups.payments.receive')}</Button></Space>}>
      {payments.length ? <ul className="survey-expense-list">{payments.map(x => <li key={x.id}>
        <Tag color="green" className="survey-expense-category">{methods.find(m => m.value === x.paymentMethod)?.label ?? x.paymentMethod}</Tag>
        <div className="survey-expense-meta"><strong>{formatMoney(x.amount,x.currency||currency)} · {formatMoney(x.baseAmount,currencyData?.baseCurrency||"USD")}</strong><small>{x.transactionNumber} · {x.category} · {when(x.createdAtUtc)}{x.notes ? ` · ${x.notes}` : ''}</small></div>
        <Button size="small" icon={<PrinterOutlined />} onClick={() => onReceipt(x)}>{t('pickups.payments.receipt')}</Button>
      </li>)}</ul> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('pickups.payments.none')} />}
      {earlierExpenses.length > 0 && <div className="pickup-legacy"><h4 className="pickup-subhead">{t('pickups.payments.earlierExpenses')}</h4>{earlierExpenses.map(x => <div key={x.id}><span>{x.transactionNumber} · {x.category}</span><b>{formatMoney(x.amount,x.currency||currency)} · {formatMoney(x.baseAmount,currencyData?.baseCurrency||"USD")}</b><ReceiptsButton kind="PICKUP" expenseId={x.id} receipts={earlierReceipts.byExpense.get(x.id) ?? []} onChanged={() => void earlierReceipts.reload()} title={t('pickups.payments.receiptsTitle', { number: x.transactionNumber })} /></div>)}</div>}
    </Card>
    <ExpensesCard receiptKind="PICKUP" categoryOptions={expenseMasters.filter(x => x.isActive).map(x => ({ value: x.code, label: x.name }))} onOpen={reloadExpenses} title={t('pickups.payments.expensesPaid')} expenses={work.expenses} totals={work.expenseTotals} employeeOptions={employeeOptions} defaultPaidBy={crewLead}
      emptyText={t('pickups.payments.noExpenses')}
      onSave={async (input, existing) => onWork(existing ? await pickupsApi.updateExpense(pickupId, existing.id, input) : await pickupsApi.addExpense(pickupId, input))}
      onDelete={async expense => onWork(await pickupsApi.deleteExpense(pickupId, expense.id))} />

    <Modal centered open={open} title={t('pickups.payments.receiveTitle')} width={860} okText={t('pickups.payments.saveAndPrint')} cancelText={t('common.cancel')} confirmLoading={busy} onOk={() => void record()} onCancel={() => setOpen(false)} destroyOnHidden>
      <Form form={form} layout="vertical" requiredMark={false}>
        <div className="money-form-grid">
          <CurrencyFields form={form}/><Form.Item className="amount-field" label={t('common.amount')} name="amount" rules={[{ required: true, message: t('pickups.payments.enterAmount') }]}><InputNumber controls={false} min={0.01} max={999999999} precision={4} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label={t('pickups.paymentMethod')} name="paymentMethod" rules={[{ required: true }]}><Select options={methods} /></Form.Item>
        </div>
        <Form.Item label={t('pickups.paymentFor')} name="category" rules={[{ required: true, whitespace: true, message: t('pickups.payments.enterPurpose') }]}><Select showSearch optionFilterProp="label" options={paymentPurposes.map(value => ({ value, label: value }))} /></Form.Item>
        <Form.Item label={t('pickups.referenceNotes')} name="notes"><Input maxLength={500} placeholder={t('pickups.payments.notesPlaceholder')} /></Form.Item>
      </Form>
    </Modal>
  </div>
}







