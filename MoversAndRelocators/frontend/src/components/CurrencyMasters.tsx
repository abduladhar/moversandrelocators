import {useContext,useRef,useState} from 'react'
import {Alert,Button,Form,Input,InputNumber,Modal,Select,Space,Switch,message} from 'antd'
import {BillingPermissions} from '../billingApi'
import {currencyApi,localDate,useCurrencies,type Currency} from '../currency'
import {DataGrid} from './DataGrid'
import {RowActions} from './RowActions'
import {useT} from '../i18n'
export function CurrencyMasters(){
 const {t}=useT()
 const {data,error,reload}=useCurrencies(),permissions=useContext(BillingPermissions),canEdit=permissions.includes('billing.accounts')
 const [open,setOpen]=useState(false),[editing,setEditing]=useState<Currency>(),[saving,setSaving]=useState(false),[form]=Form.useForm(),busy=useRef(false)
 const show=(row?:Currency)=>{setEditing(row);form.resetFields();form.setFieldsValue(row||{isActive:true,decimalPlaces:2});setOpen(true)}
 const save=async()=>{if(busy.current)return;try{const v=await form.validateFields();busy.current=true;setSaving(true);await currencyApi.save('',v);setOpen(false);await reload();message.success(t('settings.currency.currencySaved'))}catch(e){if(e instanceof Error)message.error(e.message)}finally{busy.current=false;setSaving(false)}}
 return <>
 <h2>{t('common.currency')}</h2>
 <Alert type="info" showIcon title={t('settings.currency.accountingCurrencyIs',{currency:data?.baseCurrency||'…'})} description={t('settings.currency.mastersHint')}/>
 {error&&<Alert type="error" title={error}/>}
 <Space wrap style={{margin:'16px 0'}}><Button onClick={()=>void reload()}>{t('common.refresh')}</Button>{canEdit&&<Button type="primary" onClick={()=>show()}>{t('settings.currency.addCurrency')}</Button>}<span>{t('settings.currency.workspaceDefault')}</span><Select disabled={!canEdit||saving} value={data?.settings.defaultCurrency} style={{minWidth:220}} options={data?.currencies.filter(x=>x.isActive).map(x=>({value:x.code,label:x.code+' · '+x.name}))} onChange={async value=>{setSaving(true);try{await currencyApi.save('/settings',{defaultCurrency:value});await reload()}catch(e){message.error(e instanceof Error?e.message:t('settings.currency.saveFailed'))}finally{setSaving(false)}}}/></Space>
 <DataGrid<Currency> rowKey="code" dataSource={data?.currencies||[]} columns={[{title:t('common.code'),dataIndex:'code'},{title:t('common.currency'),dataIndex:'name'},{title:t('settings.currency.decimalPlaces'),dataIndex:'decimalPlaces'},{title:t('common.active'),dataIndex:'isActive',render:v=>v?t('common.yes'):t('common.no')},{title:t('common.actions'),key:'actions',render:(_,r)=>canEdit?<RowActions><Button onClick={()=>show(r)}>{t('common.edit')}</Button></RowActions>:null}]}/>
 <Modal centered open={open} title={editing?t('settings.currency.editCurrency'):t('settings.currency.addCurrency')} okText={t('common.save')} cancelText={t('common.cancel')} onCancel={()=>!saving&&setOpen(false)} onOk={()=>void save()} confirmLoading={saving} destroyOnHidden><Form form={form} layout="vertical" disabled={saving}>
 <Form.Item name="code" label={t('settings.currency.currencyCode')} rules={[{required:true,pattern:/^[A-Z]{3}$/}]}><Input disabled={!!editing} maxLength={3}/></Form.Item><Form.Item name="name" label={t('settings.currency.currencyName')} rules={[{required:true,whitespace:true}]}><Input maxLength={100}/></Form.Item><Form.Item name="decimalPlaces" label={t('settings.currency.decimalPlaces')} rules={[{required:true}]}><Select disabled={!!editing} options={[0,1,2,3,4].map(value=>({value,label:String(value)}))}/></Form.Item><Form.Item name="isActive" label={t('common.active')} valuePropName="checked"><Switch disabled={editing?.code===data?.baseCurrency}/></Form.Item>
 </Form></Modal></>
}
export function CurrencyExchangeRates(){
 const {t}=useT()
 const {data,error,reload}=useCurrencies(),permissions=useContext(BillingPermissions),canEdit=permissions.includes('billing.accounts')
 const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[loading,setLoading]=useState(false),[rows,setRows]=useState<Currency[]>([]),[form]=Form.useForm(),busy=useRef(false)
 const show=async(startDate=localDate(),endDate?:string)=>{
  setLoading(true)
  try{
   const latest=await currencyApi.choices(),active=latest.currencies.filter(x=>x.isActive)
   setRows(active);form.resetFields()
   form.setFieldsValue({startDate,endDate:endDate||startDate,rates:active.map(c=>({currency:c.code,usdPerUnit:c.code===latest.baseCurrency?1:latest.rates.find(r=>r.currency===c.code&&r.date<=startDate)?.usdPerUnit}))})
   setOpen(true)
  }catch(e){message.error(e instanceof Error?e.message:t('settings.currency.loadCurrenciesFailed'))}finally{setLoading(false)}
 }
 const save=async()=>{
  if(busy.current)return
  try{const v=await form.validateFields();busy.current=true;setSaving(true);await currencyApi.save('/rate-periods',v);setOpen(false);await reload();message.success(t('settings.currency.ratesSaved'))}
  catch(e){if(e instanceof Error)message.error(e.message)}
  finally{busy.current=false;setSaving(false)}
 }
 return <>
 <h2>{t('settings.currency.exchangeRatesTitle')}</h2>
 <Alert type="info" showIcon title={t('settings.currency.periodTitle')} description={t('settings.currency.periodText')}/>
 {error&&<Alert type="error" title={error}/>}
 <Space wrap style={{margin:'16px 0'}}><Button onClick={()=>void reload()}>{t('common.refresh')}</Button>{canEdit&&<Button type="primary" loading={loading} onClick={()=>void show()}>{t('settings.currency.addPeriod')}</Button>}</Space>
 <DataGrid rowKey={r=>r.currency+r.date} dataSource={data?.rates||[]} scroll={{x:700}} columns={[{title:t('common.currency'),dataIndex:'currency'},{title:t('settings.currency.rateSource'),dataIndex:'isSample',render:v=>v?t('settings.currency.sampleRate'):t('settings.currency.configuredRate')},{title:t('settings.currency.fromDate'),dataIndex:'date'},{title:t('settings.currency.toDate'),dataIndex:'endDate',render:v=>v||t('settings.currency.untilSuperseded')},{title:t('settings.currency.perUnit',{currency:data?.baseCurrency||t('settings.currency.baseCurrency')}),dataIndex:'usdPerUnit',align:'right'},{title:t('common.actions'),key:'actions',render:(_,r)=>canEdit?<RowActions><Button onClick={()=>void show(r.date,r.endDate)}>{t('settings.currency.editPeriod')}</Button></RowActions>:null}]}/>
 <Modal centered width={850} open={open} title={t('settings.currency.ratesModalTitle')} okText={t('settings.currency.saveAllRates')} cancelText={t('common.cancel')} onCancel={()=>!saving&&setOpen(false)} onOk={()=>void save()} confirmLoading={saving} destroyOnHidden>
 <Form form={form} layout="vertical" disabled={saving}>
 <div className="job-form-grid"><Form.Item name="startDate" label={t('settings.currency.fromDate')} rules={[{required:true}]}><Input type="date"/></Form.Item><Form.Item name="endDate" label={t('settings.currency.toDateInclusive')} dependencies={['startDate']} rules={[{required:true},({getFieldValue})=>({validator:async(_,v)=>{if(v&&v<getFieldValue('startDate'))throw new Error(t('settings.currency.endBeforeStart'))}})]}><Input type="date"/></Form.Item></div>
 <Alert type="info" title={t('settings.currency.reviewTitle')} description={t('settings.currency.reviewText')}/>
 <div style={{maxHeight:'50vh',overflowY:'auto',marginTop:16}}>
 <Form.List name="rates">{fields=><>{fields.map(field=><div key={field.key} className="job-form-grid" style={{borderBottom:'1px solid #e8eee9',paddingTop:8}}>
 <div><strong>{rows[field.name]?.code}</strong><p>{rows[field.name]?.name}</p><Form.Item name={[field.name,'currency']} hidden><Input/></Form.Item></div>
 <Form.Item name={[field.name,'usdPerUnit']} className="amount-field" label={'1 '+rows[field.name]?.code+' = '+data?.baseCurrency} rules={[{required:true,message:t('settings.currency.enterRate')}]}><InputNumber aria-label={t('settings.currency.rateFor',{currency:rows[field.name]?.code})} disabled={saving||rows[field.name]?.code===data?.baseCurrency} controls={false} min={0.000000000001} max={1000000} precision={12} style={{width:'100%'}}/></Form.Item>
 </div>)}</>}</Form.List>
 </div></Form></Modal></>
}
