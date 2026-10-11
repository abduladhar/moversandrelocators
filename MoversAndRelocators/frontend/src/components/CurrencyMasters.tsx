import {useContext,useRef,useState} from 'react'
import {Alert,Button,Form,Input,InputNumber,Modal,Select,Space,Switch,message} from 'antd'
import {BillingPermissions} from '../billingApi'
import {currencyApi,localDate,useCurrencies,type Currency} from '../currency'
import {DataGrid} from './DataGrid'
import {RowActions} from './RowActions'
export function CurrencyMasters(){
 const {data,error,reload}=useCurrencies(),permissions=useContext(BillingPermissions),canEdit=permissions.includes('billing.accounts')
 const [open,setOpen]=useState(false),[editing,setEditing]=useState<Currency>(),[saving,setSaving]=useState(false),[form]=Form.useForm(),busy=useRef(false)
 const show=(row?:Currency)=>{setEditing(row);form.resetFields();form.setFieldsValue(row||{isActive:true,decimalPlaces:2});setOpen(true)}
 const save=async()=>{if(busy.current)return;try{const v=await form.validateFields();busy.current=true;setSaving(true);await currencyApi.save('',v);setOpen(false);await reload();message.success('Currency saved')}catch(e){if(e instanceof Error)message.error(e.message)}finally{busy.current=false;setSaving(false)}}
 return <>
 <h2>Currency</h2>
 <Alert type="info" showIcon title={"Accounting currency: "+(data?.baseCurrency||"…")} description="Configure the accounting base under Settings → System currency. Maintain currencies and the transaction default here. Enter dated rates on the separate Currency Exchange Rates page."/>
 {error&&<Alert type="error" title={error}/>}
 <Space wrap style={{margin:'16px 0'}}><Button onClick={()=>void reload()}>Refresh</Button>{canEdit&&<Button type="primary" onClick={()=>show()}>Add currency</Button>}<span>Location / workspace default</span><Select disabled={!canEdit||saving} value={data?.settings.defaultCurrency} style={{minWidth:220}} options={data?.currencies.filter(x=>x.isActive).map(x=>({value:x.code,label:x.code+' · '+x.name}))} onChange={async value=>{setSaving(true);try{await currencyApi.save('/settings',{defaultCurrency:value});await reload()}catch(e){message.error(e instanceof Error?e.message:'Unable to save')}finally{setSaving(false)}}}/></Space>
 <DataGrid<Currency> rowKey="code" dataSource={data?.currencies||[]} columns={[{title:'Code',dataIndex:'code'},{title:'Currency',dataIndex:'name'},{title:'Decimal places',dataIndex:'decimalPlaces'},{title:'Active',dataIndex:'isActive',render:v=>v?'Yes':'No'},{title:'Actions',key:'actions',render:(_,r)=>canEdit?<RowActions><Button onClick={()=>show(r)}>Edit</Button></RowActions>:null}]}/>
 <Modal centered open={open} title={editing?'Edit currency':'Add currency'} onCancel={()=>!saving&&setOpen(false)} onOk={()=>void save()} confirmLoading={saving} destroyOnHidden><Form form={form} layout="vertical" disabled={saving}>
 <Form.Item name="code" label="Currency code" rules={[{required:true,pattern:/^[A-Z]{3}$/}]}><Input disabled={!!editing} maxLength={3}/></Form.Item><Form.Item name="name" label="Currency name" rules={[{required:true,whitespace:true}]}><Input maxLength={100}/></Form.Item><Form.Item name="decimalPlaces" label="Decimal places" rules={[{required:true}]}><Select disabled={!!editing} options={[0,1,2,3,4].map(value=>({value,label:String(value)}))}/></Form.Item><Form.Item name="isActive" label="Active" valuePropName="checked"><Switch disabled={editing?.code===data?.baseCurrency}/></Form.Item>
 </Form></Modal></>
}
export function CurrencyExchangeRates(){
 const {data,error,reload}=useCurrencies(),permissions=useContext(BillingPermissions),canEdit=permissions.includes('billing.accounts')
 const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[loading,setLoading]=useState(false),[rows,setRows]=useState<Currency[]>([]),[form]=Form.useForm(),busy=useRef(false)
 const show=async(startDate=localDate(),endDate?:string)=>{
  setLoading(true)
  try{
   const latest=await currencyApi.choices(),active=latest.currencies.filter(x=>x.isActive)
   setRows(active);form.resetFields()
   form.setFieldsValue({startDate,endDate:endDate||startDate,rates:active.map(c=>({currency:c.code,usdPerUnit:c.code===latest.baseCurrency?1:latest.rates.find(r=>r.currency===c.code&&r.date<=startDate)?.usdPerUnit}))})
   setOpen(true)
  }catch(e){message.error(e instanceof Error?e.message:'Unable to load currencies')}finally{setLoading(false)}
 }
 const save=async()=>{
  if(busy.current)return
  try{const v=await form.validateFields();busy.current=true;setSaving(true);await currencyApi.save('/rate-periods',v);setOpen(false);await reload();message.success('Exchange rates saved for all currencies')}
  catch(e){if(e instanceof Error)message.error(e.message)}
  finally{busy.current=false;setSaving(false)}
 }
 return <>
 <h2>Currency Exchange Rates</h2>
 <Alert type="info" showIcon title="Set rates for all active currencies for one period" description="Choose inclusive start and end dates. Enter the system-currency value of one unit. The system currency remains 1. Previously recorded transactions retain their saved rates."/>
 {error&&<Alert type="error" title={error}/>}
 <Space wrap style={{margin:'16px 0'}}><Button onClick={()=>void reload()}>Refresh</Button>{canEdit&&<Button type="primary" loading={loading} onClick={()=>void show()}>Add exchange rate period</Button>}</Space>
 <DataGrid rowKey={r=>r.currency+r.date} dataSource={data?.rates||[]} scroll={{x:700}} columns={[{title:'Currency',dataIndex:'currency'},{title:'Rate source',dataIndex:'isSample',render:v=>v?'Sample (testing)':'Configured'},{title:'From date',dataIndex:'date'},{title:'To date',dataIndex:'endDate',render:v=>v||'Until superseded (legacy)'},{title:(data?.baseCurrency||'Base currency')+' per unit',dataIndex:'usdPerUnit',align:'right'},{title:'Actions',key:'actions',render:(_,r)=>canEdit?<RowActions><Button onClick={()=>void show(r.date,r.endDate)}>Edit period for all currencies</Button></RowActions>:null}]}/>
 <Modal centered width={850} open={open} title="Exchange rates for all currencies" okText="Save all exchange rates" onCancel={()=>!saving&&setOpen(false)} onOk={()=>void save()} confirmLoading={saving} destroyOnHidden>
 <Form form={form} layout="vertical" disabled={saving}>
 <div className="job-form-grid"><Form.Item name="startDate" label="From date" rules={[{required:true}]}><Input type="date"/></Form.Item><Form.Item name="endDate" label="To date (inclusive)" dependencies={['startDate']} rules={[{required:true},({getFieldValue})=>({validator:async(_,v)=>{if(v&&v<getFieldValue('startDate'))throw new Error('End date must be on or after start date')}})]}><Input type="date"/></Form.Item></div>
 <Alert type="info" title="Review every rate before saving" description="Existing rates are copied as a starting point. Fill any empty rates. Saving the same start date updates that period; overlapping periods are rejected."/>
 <div style={{maxHeight:'50vh',overflowY:'auto',marginTop:16}}>
 <Form.List name="rates">{fields=><>{fields.map(field=><div key={field.key} className="job-form-grid" style={{borderBottom:'1px solid #e8eee9',paddingTop:8}}>
 <div><strong>{rows[field.name]?.code}</strong><p>{rows[field.name]?.name}</p><Form.Item name={[field.name,'currency']} hidden><Input/></Form.Item></div>
 <Form.Item name={[field.name,'usdPerUnit']} className="amount-field" label={'1 '+rows[field.name]?.code+' = '+data?.baseCurrency} rules={[{required:true,message:'Enter the rate for this currency.'}]}><InputNumber aria-label={'Exchange rate for '+rows[field.name]?.code} disabled={saving||rows[field.name]?.code===data?.baseCurrency} controls={false} min={0.000000000001} max={1000000} precision={12} style={{width:'100%'}}/></Form.Item>
 </div>)}</>}</Form.List>
 </div></Form></Modal></>
}


