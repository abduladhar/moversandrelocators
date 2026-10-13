import { Alert, Button, Form, Input, InputNumber, Select } from 'antd'
import type { FormInstance } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { CurrencyFields, formatMoney, type CurrencyChoices } from '../currency'
import type { Choices } from '../billingApi'
import { useT } from '../i18n'

export function NewBillingDocumentForm({form,choices,currencies,sourceId,direction,currency}:{
 form:FormInstance;choices:Choices;currencies?:CurrencyChoices;sourceId?:string;direction:string;currency:string
}){
 const {t}=useT()
 const invoice=direction==='INCOME'
 const lines=Form.useWatch('lines',form) as {amount?:number;quantity?:number;unitPrice?:number}[]|undefined
 const lineAmount=(line:{quantity?:number;unitPrice?:number}|undefined)=>Number(((Number(line?.quantity??1)||0)*(Number(line?.unitPrice)||0)).toFixed(currencies?.currencies.find(c=>c.code===currency)?.decimalPlaces??2))
 const total=(lines||[]).reduce((sum,line)=>sum+lineAmount(line),0)
 const precision=currencies?.currencies.find(c=>c.code===currency)?.decimalPlaces??2
 const availableCharges=choices.chargeMasters.filter(m=>m.isActive&&(invoice?m.incomeAccount:m.expenseAccount))
 const parties=(invoice?choices.customers:choices.vendors).filter(p=>p.isActive)
 return <div className="document-composer">
 <div className="document-intro"><span>{invoice?t('billing.newDocument.customerInvoice'):t('billing.newDocument.vendorBill')}</span><p>{invoice?t('billing.newDocument.invoiceIntro'):t('billing.newDocument.billIntro')} {t('billing.newDocument.numberAssigned')}</p></div>
 <Form.Item name="direction" hidden><Input/></Form.Item>
 <section className="document-section">
 <h3>{t('billing.newDocument.details')}</h3>
 <div className="document-details-grid">
 <Form.Item className="document-party" name="partyCode" label={invoice?t('common.customer'):t('billing.columns.vendor')} rules={[{required:true,message:invoice?t('billing.newDocument.selectCustomer'):t('billing.newDocument.selectVendor')}]}>
 <Select showSearch placeholder={invoice?t('billing.newDocument.customerPlaceholder'):t('billing.newDocument.vendorPlaceholder')} optionFilterProp="label" options={parties.map(p=>({value:p.code,label:p.name+' · '+p.code}))} onChange={code=>form.setFieldValue('currency',parties.find(p=>p.code===code)?.currency||currencies?.settings.defaultCurrency)}/>
 </Form.Item>
 <Form.Item name="date" label={invoice?t('billing.newDocument.invoiceDate'):t('billing.newDocument.billDate')} rules={[{required:true,message:t('common.required')}]}><Input type="date"/></Form.Item>
 <Form.Item name="dueDate" label={t('billing.columns.dueDate')} dependencies={['date']} rules={[{required:true,message:t('common.required')},({getFieldValue})=>({validator:async(_,value)=>{if(value&&value<getFieldValue('date'))throw new Error(t('billing.newDocument.dueDateError'))}})]}><Input type="date"/></Form.Item>
 <Form.Item className="document-wide" name="reference" label={invoice?t('billing.newDocument.customerReference'):t('billing.newDocument.supplierReference')}><Input placeholder={t('billing.newDocument.referencePlaceholder')} maxLength={120}/></Form.Item>
 {!sourceId&&<Form.Item className="document-wide" name="sourceId" label={t('billing.newDocument.relatedOperation')} extra={t('billing.newDocument.relatedOperationHelp')}><Select allowClear showSearch placeholder={t('billing.newDocument.noLinkedOperation')} optionFilterProp="label" options={choices.sources.map(s=>({value:s.id,label:s.kind+' · '+s.label}))}/></Form.Item>}
 </div>
 </section>
 <section className="document-section"><h3>{t('billing.newDocument.currencySection')}</h3><CurrencyFields form={form}/></section>
 <section className="document-section document-charges">
 <div className="document-section-heading"><h3>{t('billing.newDocument.charges')}</h3><span>{t('billing.newDocument.amountsIn',{currency})}</span></div>
 <Alert className="document-charge-help" type={availableCharges.length?'info':'warning'} showIcon title={availableCharges.length?t('billing.newDocument.chargeHelp'):t('billing.newDocument.noCharges')}/>
 <Form.List name="lines" rules={[{validator:async(_,value)=>{if(!value?.length)throw new Error(t('billing.chargeForm.addAtLeastOne'))}}]}>{(rows,{add,remove},errors)=><>
 <div className="document-charge-head" aria-hidden="true"><span>{t('billing.columns.charge')}</span><span>{t('common.description')}</span><span>{t('billing.print.qty')}</span><span>{t('billing.print.amountPerItem')}</span><span>{t('billing.newDocument.totalIn',{currency})}</span><span/></div>
 {rows.map(row=><div className="document-charge-row" key={row.key}>
 <Form.Item name={[row.name,'chargeMasterId']} label={t('billing.columns.charge')} rules={[{required:true,message:t('billing.newDocument.selectCharge')}]}>
 <Select aria-label={t('billing.chargeForm.chargeTitle',{number:row.name+1})} showSearch placeholder={t('billing.newDocument.chargePlaceholder')} optionFilterProp="label" options={availableCharges.map(m=>({value:m.id,label:m.name}))} onChange={id=>{const master=choices.chargeMasters.find(m=>m.id===id);if(master){form.setFieldValue(['lines',row.name,'unitPrice'],Number(master.defaultRate.toFixed(precision)));form.setFieldValue(['lines',row.name,'description'],master.name)}}}/></Form.Item>
 <Form.Item name={[row.name,'description']} label={t('common.description')}><Input aria-label={t('billing.newDocument.descriptionAria',{number:row.name+1})} placeholder={t('billing.newDocument.descriptionPlaceholder')} maxLength={500}/></Form.Item>
 <Form.Item name={[row.name,'quantity']} label={t('billing.print.qty')} initialValue={1} rules={[{required:true,message:t('common.required')},{type:'number',min:0.0001,max:1000000}]}><InputNumber aria-label={t('billing.newDocument.quantityAria',{number:row.name+1})} controls={false} min={0.0001} max={1000000} precision={4}/></Form.Item>
 <Form.Item className="amount-field" name={[row.name,'unitPrice']} label={t('billing.print.amountPerItem')} rules={[{required:true,message:t('billing.newDocument.enterPrice')},{type:'number',min:1/10**precision,message:t('billing.newDocument.positivePrice')}]}><InputNumber aria-label={t('billing.newDocument.priceAria',{number:row.name+1})} controls={false} min={1/10**precision} max={1000000000} precision={precision}/></Form.Item>
 <div className="document-line-total"><span>{t('billing.newDocument.totalIn',{currency})}</span><strong>{formatMoney(lineAmount(lines?.[row.name]),currency,precision)}</strong></div>
 <Button className="document-remove-charge" type="text" danger icon={<DeleteOutlined/>} aria-label={t('billing.newDocument.removeAria',{number:row.name+1})} onClick={()=>remove(row.name)}/>
 </div>)}
 <Form.ErrorList errors={errors.errors}/>
 <Button type="dashed" icon={<PlusOutlined/>} onClick={()=>add({quantity:1,unitPrice:0})} className="document-add-charge">{t('billing.newDocument.addCharge')}</Button>
 </>}</Form.List>
 </section>
 <div className="document-bottom">
 <Form.Item name="notes" label={t('billing.newDocument.notes')}><Input.TextArea rows={3} maxLength={2000} showCount placeholder={invoice?t('billing.newDocument.invoiceNotesPlaceholder'):t('billing.newDocument.billNotesPlaceholder')}/></Form.Item>
 <div className="document-total" aria-live="polite"><span>{invoice?t('billing.newDocument.invoiceTotal'):t('billing.newDocument.billTotal')}</span><strong>{formatMoney(total,currency,precision)}</strong><small>{t('billing.newDocument.chargeCount',{count:lines?.length||0,currency})}</small></div>
 </div>
 </div>
}
