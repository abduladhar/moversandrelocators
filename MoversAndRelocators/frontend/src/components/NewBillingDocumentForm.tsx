import { Alert, Button, Form, Input, InputNumber, Select } from 'antd'
import type { FormInstance } from 'antd'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { CurrencyFields, formatMoney, type CurrencyChoices } from '../currency'
import type { Choices } from '../billingApi'

export function NewBillingDocumentForm({form,choices,currencies,sourceId,direction,currency}:{
 form:FormInstance;choices:Choices;currencies?:CurrencyChoices;sourceId?:string;direction:string;currency:string
}){
 const invoice=direction==='INCOME'
 const lines=Form.useWatch('lines',form) as {amount?:number;quantity?:number;unitPrice?:number}[]|undefined
 const lineAmount=(line:{quantity?:number;unitPrice?:number}|undefined)=>Number(((Number(line?.quantity??1)||0)*(Number(line?.unitPrice)||0)).toFixed(currencies?.currencies.find(c=>c.code===currency)?.decimalPlaces??2))
 const total=(lines||[]).reduce((sum,line)=>sum+lineAmount(line),0)
 const precision=currencies?.currencies.find(c=>c.code===currency)?.decimalPlaces??2
 const availableCharges=choices.chargeMasters.filter(m=>m.isActive&&(invoice?m.incomeAccount:m.expenseAccount))
 const parties=(invoice?choices.customers:choices.vendors).filter(p=>p.isActive)
 return <div className="document-composer">
 <div className="document-intro"><span>{invoice?'CUSTOMER INVOICE':'VENDOR BILL'}</span><p>{invoice?'Choose a customer and add the services you are charging for.':'Choose a vendor and add the charges you need to pay.'} The document number is assigned when saved.</p></div>
 <Form.Item name="direction" hidden><Input/></Form.Item>
 <section className="document-section">
 <h3>Document details</h3>
 <div className="document-details-grid">
 <Form.Item className="document-party" name="partyCode" label={invoice?'Customer':'Vendor'} rules={[{required:true,message:invoice?'Select a customer':'Select a vendor'}]}>
 <Select showSearch placeholder={invoice?'Select customer':'Select vendor'} optionFilterProp="label" options={parties.map(p=>({value:p.code,label:p.name+' · '+p.code}))} onChange={code=>form.setFieldValue('currency',parties.find(p=>p.code===code)?.currency||currencies?.settings.defaultCurrency)}/>
 </Form.Item>
 <Form.Item name="date" label={invoice?'Invoice date':'Bill date'} rules={[{required:true}]}><Input type="date"/></Form.Item>
 <Form.Item name="dueDate" label="Due date" dependencies={['date']} rules={[{required:true},({getFieldValue})=>({validator:async(_,value)=>{if(value&&value<getFieldValue('date'))throw new Error('Due date must be on or after the document date')}})]}><Input type="date"/></Form.Item>
 <Form.Item className="document-wide" name="reference" label={invoice?'Customer reference (optional)':'Supplier reference (optional)'}><Input placeholder="Reference or purchase order number" maxLength={120}/></Form.Item>
 {!sourceId&&<Form.Item className="document-wide" name="sourceId" label="Related operation (optional)" extra="Leave empty for a direct invoice or bill."><Select allowClear showSearch placeholder="No linked operation" optionFilterProp="label" options={choices.sources.map(s=>({value:s.id,label:s.kind+' · '+s.label}))}/></Form.Item>}
 </div>
 </section>
 <section className="document-section"><h3>Currency & exchange rate</h3><CurrencyFields form={form}/></section>
 <section className="document-section document-charges">
 <div className="document-section-heading"><h3>Charges</h3><span>Amounts in {currency}</span></div>
 <Alert className="document-charge-help" type={availableCharges.length?'info':'warning'} showIcon title={availableCharges.length?'Select a charge to fill its description and default amount. Enter the amount if no price is configured.':'No active charges are configured for this document. Add a charge under Invoicing & billing → Charge master mappings, or enable its account mapping.'}/>
 <Form.List name="lines" rules={[{validator:async(_,value)=>{if(!value?.length)throw new Error('Add at least one charge')}}]}>{(rows,{add,remove},errors)=><>
 <div className="document-charge-head" aria-hidden="true"><span>Charge</span><span>Description</span><span>Qty</span><span>Amount per item</span><span>Total ({currency})</span><span/></div>
 {rows.map(row=><div className="document-charge-row" key={row.key}>
 <Form.Item name={[row.name,'chargeMasterId']} label="Charge" rules={[{required:true,message:'Select a charge'}]}>
 <Select aria-label={'Charge '+(row.name+1)} showSearch placeholder="Select charge" optionFilterProp="label" options={availableCharges.map(m=>({value:m.id,label:m.name}))} onChange={id=>{const master=choices.chargeMasters.find(m=>m.id===id);if(master){form.setFieldValue(['lines',row.name,'unitPrice'],Number(master.defaultRate.toFixed(precision)));form.setFieldValue(['lines',row.name,'description'],master.name)}}}/></Form.Item>
 <Form.Item name={[row.name,'description']} label="Description"><Input aria-label={'Description for charge '+(row.name+1)} placeholder="Service description" maxLength={500}/></Form.Item>
 <Form.Item name={[row.name,'quantity']} label="Qty" initialValue={1} rules={[{required:true},{type:'number',min:0.0001,max:1000000}]}><InputNumber aria-label={'Quantity for charge '+(row.name+1)} controls={false} min={0.0001} max={1000000} precision={4}/></Form.Item>
 <Form.Item className="amount-field" name={[row.name,'unitPrice']} label="Amount per item" rules={[{required:true,message:'Enter price per item'},{type:'number',min:1/10**precision,message:'Enter a positive price'}]}><InputNumber aria-label={'Amount per item for charge '+(row.name+1)} controls={false} min={1/10**precision} max={1000000000} precision={precision}/></Form.Item>
 <div className="document-line-total"><span>Total ({currency})</span><strong>{formatMoney(lineAmount(lines?.[row.name]),currency,precision)}</strong></div>
 <Button className="document-remove-charge" type="text" danger icon={<DeleteOutlined/>} aria-label={'Remove charge '+(row.name+1)} onClick={()=>remove(row.name)}/>
 </div>)}
 <Form.ErrorList errors={errors.errors}/>
 <Button type="dashed" icon={<PlusOutlined/>} onClick={()=>add({quantity:1,unitPrice:0})} className="document-add-charge">Add charge</Button>
 </>}</Form.List>
 </section>
 <div className="document-bottom">
 <Form.Item name="notes" label="Notes (optional)"><Input.TextArea rows={3} maxLength={2000} showCount placeholder={invoice?'Additional information for your customer':'Additional information about this bill'}/></Form.Item>
 <div className="document-total" aria-live="polite"><span>{invoice?'Invoice total':'Bill total'}</span><strong>{formatMoney(total,currency,precision)}</strong><small>{lines?.length||0} charge{lines?.length===1?'':'s'} · {currency}</small></div>
 </div>
 </div>
}


