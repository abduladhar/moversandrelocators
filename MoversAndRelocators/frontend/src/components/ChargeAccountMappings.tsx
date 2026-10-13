import { useContext,useEffect,useState } from 'react'
import { Button,Form,Input,InputNumber,Modal,Select,Space,message } from 'antd'
import { BillingPermissions,billingApi,type Choices,type MappedCharge } from '../billingApi'
import { DataGrid } from './DataGrid'
import { useT } from '../i18n'
export function ChargeAccountMappings(){
 const {t}=useT()
 const permissions=useContext(BillingPermissions),[data,setData]=useState<Choices>(),[editing,setEditing]=useState<MappedCharge|null>(),[saving,setSaving]=useState(false),[form]=Form.useForm()
 const load=()=>billingApi.choices().then(setData).catch(e=>message.error(e.message))
 useEffect(()=>{void load()},[])
 const allowed=permissions.includes('billing.accounts')
 const open=(row:MappedCharge|null)=>{form.resetFields();form.setFieldsValue(row??{unit:'service',defaultRate:0,incomeAccount:'4300',expenseAccount:'5600'});setEditing(row)}
 const save=async()=>{try{const v=await form.validateFields();setSaving(true);await billingApi.save(editing?'charge-mappings':'charge-masters',{...v,chargeMasterId:editing?.id,incomeAccount:v.incomeAccount||null,expenseAccount:v.expenseAccount||null});setEditing(undefined);await load();message.success(t('billing.mappings.saved'))}catch(e){if(e instanceof Error)message.error(e.message)}finally{setSaving(false)}}
 const required=[{required:true,message:t('common.required')}]
 return <><Space style={{marginBottom:12}}><Button onClick={()=>void load()}>{t('billing.mappings.refresh')}</Button>{allowed&&<Button type="primary" onClick={()=>open(null)}>{t('billing.mappings.addChargeMaster')}</Button>}</Space>
 <DataGrid<MappedCharge> rowKey="id" dataSource={data?.chargeMasters??[]} columns={[{title:t('billing.columns.charge'),dataIndex:'name'},{title:t('billing.mappings.customerChargeAccount'),dataIndex:'incomeAccount'},{title:t('billing.mappings.vendorChargeAccount'),dataIndex:'expenseAccount'},{title:t('billing.mappings.defaultAmount'),dataIndex:'defaultRate'},{title:t('common.actions'),key:'actions',render:(_,r)=>allowed?<Button onClick={()=>open(r)}>{t('billing.mappings.mapAccounts')}</Button>:null}]}/>
 <Modal centered open={editing!==undefined} title={editing?t('billing.mappings.mappingTitle',{name:editing.name}):t('billing.mappings.newChargeMaster')} onCancel={()=>!saving&&setEditing(undefined)} onOk={()=>void save()} okText={t('common.save')} cancelText={t('common.cancel')} confirmLoading={saving} destroyOnHidden>
 <Form form={form} layout="vertical">{!editing&&<><Form.Item name="name" label={t('billing.mappings.chargeName')} rules={required}><Input maxLength={160}/></Form.Item><Form.Item name="unit" label={t('billing.mappings.unit')} rules={required}><Input maxLength={30}/></Form.Item><Form.Item name="defaultRate" label={t('billing.mappings.defaultAmount')} className="amount-field" rules={required}><InputNumber controls={false} min={0} precision={4} style={{width:'100%'}}/></Form.Item></>}
 {(['incomeAccount','expenseAccount'] as const).map((name,i)=><Form.Item key={name} name={name} label={i===0?t('billing.mappings.revenueAccount'):t('billing.mappings.expenseAccount')}><Select allowClear showSearch optionFilterProp="label" options={data?.accounts.filter(a=>a.isActive&&a.type===(i===0?'Revenue':'Expense')).map(a=>({value:a.code,label:a.code+' · '+a.name}))}/></Form.Item>)}
 <p>{t('billing.mappings.help')}</p></Form></Modal></>
}
