import {useEffect,useRef,useState} from 'react'
import {Alert,Button,Card,Form,Select,Space,Tag,message} from 'antd'
import {currencyApi,type CurrencyChoices} from '../currency'
import {PageHeader} from '../components/PageHeader'
import {useT} from '../i18n'
export function CurrencyConfigurationPage(){
 const {t}=useT()
 const [data,setData]=useState<CurrencyChoices>(),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState(''),[form]=Form.useForm(),busy=useRef(false)
 const load=async()=>{setLoading(true);try{const c=await currencyApi.choices();setData(c);form.setFieldsValue({baseCurrency:c.baseCurrency,defaultCurrency:c.settings.defaultCurrency});setError('')}catch(e){setError(e instanceof Error?e.message:t('settings.currency.loadFailed'))}finally{setLoading(false)}}
 useEffect(()=>{void load()},[])
 const save=async()=>{if(busy.current)return;try{const v=await form.validateFields();busy.current=true;setSaving(true);await currencyApi.save('/settings',v);await load();message.success(t('settings.currency.saved'))}catch(e){if(e instanceof Error)message.error(e.message)}finally{busy.current=false;setSaving(false)}}
 return <>
 <PageHeader eyebrow={t('settings.currency.eyebrow')} title={t('settings.currency.title')} description={t('settings.currency.description')} onRefresh={load} refreshDisabled={saving||loading} refreshConfirm={t('settings.common.refreshConfirm')}/>
 {error&&<Alert type="error" title={error}/>}
 <Card loading={loading} style={{maxWidth:800}}>
 <Form form={form} layout="vertical" disabled={saving||!data}>
 <Form.Item name="baseCurrency" label={t('settings.currency.accountingCurrency')} rules={[{required:true}]} extra={t('settings.currency.accountingCurrencyHint')}><Select disabled={saving||!!data?.baseCurrencyLocked} showSearch optionFilterProp="label" options={data?.currencies.filter(c=>c.isActive).map(c=>({value:c.code,label:c.code+' · '+c.name}))}/></Form.Item>
 {data?.baseCurrencyLocked?<Alert type="info" showIcon title={t('settings.currency.lockedTitle')} description={t('settings.currency.lockedText')}/>:<Alert type="info" showIcon title={t('settings.currency.chooseFirstTitle')} description={t('settings.currency.chooseFirstText')}/>}
 <Form.Item name="defaultCurrency" label={t('settings.currency.defaultTransactionCurrency')} rules={[{required:true}]} style={{marginTop:20}} extra={t('settings.currency.defaultTransactionHint')}><Select showSearch optionFilterProp="label" options={data?.currencies.filter(c=>c.isActive).map(c=>({value:c.code,label:c.code+' · '+c.name}))}/></Form.Item>
 <Space wrap><Button type="primary" loading={saving} disabled={loading||!data} onClick={()=>void save()}>{t('settings.currency.saveConfiguration')}</Button>{data&&<Tag>{t('settings.currency.currentAccountingCurrency',{currency:data.baseCurrency})}</Tag>}</Space>
 </Form></Card></>
}
