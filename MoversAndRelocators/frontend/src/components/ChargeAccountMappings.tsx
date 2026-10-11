import { useContext,useEffect,useState } from 'react'
import { Button,Form,Input,InputNumber,Modal,Select,Space,message } from 'antd'
import { BillingPermissions,billingApi,type Choices,type MappedCharge } from '../billingApi'
import { DataGrid } from './DataGrid'
export function ChargeAccountMappings(){
 const permissions=useContext(BillingPermissions),[data,setData]=useState<Choices>(),[editing,setEditing]=useState<MappedCharge|null>(),[saving,setSaving]=useState(false),[form]=Form.useForm()
 const load=()=>billingApi.choices().then(setData).catch(e=>message.error(e.message))
 useEffect(()=>{void load()},[])
 const allowed=permissions.includes('billing.accounts')
 const open=(row:MappedCharge|null)=>{form.resetFields();form.setFieldsValue(row??{unit:'service',defaultRate:0,incomeAccount:'4300',expenseAccount:'5600'});setEditing(row)}
 const save=async()=>{try{const v=await form.validateFields();setSaving(true);await billingApi.save(editing?'charge-mappings':'charge-masters',{...v,chargeMasterId:editing?.id,incomeAccount:v.incomeAccount||null,expenseAccount:v.expenseAccount||null});setEditing(undefined);await load();message.success('Charge master mapping saved')}catch(e){if(e instanceof Error)message.error(e.message)}finally{setSaving(false)}}
 return <><Space style={{marginBottom:12}}><Button onClick={()=>void load()}>Refresh mappings</Button>{allowed&&<Button type="primary" onClick={()=>open(null)}>Add charge master</Button>}</Space>
 <DataGrid<MappedCharge> rowKey="id" dataSource={data?.chargeMasters??[]} columns={[{title:'Charge',dataIndex:'name'},{title:'Customer charge account',dataIndex:'incomeAccount'},{title:'Vendor charge account',dataIndex:'expenseAccount'},{title:'Default amount',dataIndex:'defaultRate'},{title:'Actions',key:'actions',render:(_,r)=>allowed?<Button onClick={()=>open(r)}>Map accounts</Button>:null}]}/>
 <Modal centered open={editing!==undefined} title={editing?'Account mapping · '+editing.name:'New charge master'} onCancel={()=>!saving&&setEditing(undefined)} onOk={()=>void save()} confirmLoading={saving} destroyOnHidden>
 <Form form={form} layout="vertical">{!editing&&<><Form.Item name="name" label="Charge name" rules={[{required:true}]}><Input maxLength={160}/></Form.Item><Form.Item name="unit" label="Unit" rules={[{required:true}]}><Input maxLength={30}/></Form.Item><Form.Item name="defaultRate" label="Default amount" className="amount-field" rules={[{required:true}]}><InputNumber controls={false} min={0} precision={4} style={{width:'100%'}}/></Form.Item></>}
 {(['incomeAccount','expenseAccount'] as const).map((name,i)=><Form.Item key={name} name={name} label={i===0?'Customer charge → Revenue account':'Vendor charge → Expense account'}><Select allowClear showSearch optionFilterProp="label" options={data?.accounts.filter(a=>a.isActive&&a.type===(i===0?'Revenue':'Expense')).map(a=>({value:a.code,label:a.code+' · '+a.name}))}/></Form.Item>)}
 <p>Users select a charge; its mapped account is applied automatically. Existing captured charges keep their original account.</p></Form></Modal></>
}


