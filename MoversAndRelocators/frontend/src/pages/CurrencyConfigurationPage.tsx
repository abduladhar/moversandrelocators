import {useEffect,useRef,useState} from 'react'
import {Alert,Button,Card,Form,Select,Space,Tag,message} from 'antd'
import {currencyApi,type CurrencyChoices} from '../currency'
import {PageHeader} from '../components/PageHeader'
export function CurrencyConfigurationPage(){
 const [data,setData]=useState<CurrencyChoices>(),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[form]=Form.useForm(),busy=useRef(false)
 const load=async()=>{setLoading(true);try{const c=await currencyApi.choices();setData(c);form.setFieldsValue({baseCurrency:c.baseCurrency,defaultCurrency:c.settings.defaultCurrency});setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to load configuration')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[])
 const save=async()=>{if(busy.current)return;try{const v=await form.validateFields();busy.current=true;setSaving(true);await currencyApi.save('/settings',v);await load();message.success('System currency configuration saved')}catch(e){if(e instanceof Error)message.error(e.message)}finally{busy.current=false;setSaving(false)}}
 return <>
 <PageHeader eyebrow="SYSTEM SETTINGS" title="System currency" description="Configure the accounting currency for this workspace." onRefresh={load} refreshDisabled={saving||loading} refreshConfirm="Refreshing replaces unsaved configuration changes."/>
 {error&&<Alert type="error" title={error}/>}
 <Card loading={loading} style={{maxWidth:800}}>
 <Form form={form} layout="vertical" disabled={saving||!data}>
 <Form.Item name="baseCurrency" label="System accounting currency" rules={[{required:true}]} extra="Base amounts, accounting reports and exchange rates use this currency. Its exchange rate is always 1."><Select disabled={saving||!!data?.baseCurrencyLocked} showSearch optionFilterProp="label" options={data?.currencies.filter(c=>c.isActive).map(c=>({value:c.code,label:c.code+' · '+c.name}))}/></Form.Item>
 {data?.baseCurrencyLocked?<Alert type="info" showIcon title="Accounting currency is locked for this workspace" description="Financial records already exist. Changing their accounting currency requires a controlled migration of historical values. The transaction default below can still be changed."/>:<Alert type="info" showIcon title="Choose before recording financial activity" description="Changing the accounting currency requires a new exchange-rate schedule. Rates entered for a previous base are kept separately and are not reused. The accounting currency locks after the first financial record."/>}
 <Form.Item name="defaultCurrency" label="Default transaction currency" rules={[{required:true}]} style={{marginTop:20}} extra="Suggested for new entries when a customer or vendor has no separate currency preference."><Select showSearch optionFilterProp="label" options={data?.currencies.filter(c=>c.isActive).map(c=>({value:c.code,label:c.code+' · '+c.name}))}/></Form.Item>
 <Space><Button type="primary" loading={saving} disabled={loading||!data} onClick={()=>void save()}>Save configuration</Button>{data&&<Tag>Current accounting currency: {data.baseCurrency}</Tag>}</Space>
 </Form></Card></>
}
