import {useEffect,useMemo,useState} from 'react'
import {Button,Card,Form,Modal,Select,Tag,message} from 'antd'
import type {ColumnsType} from 'antd/es/table'
import {deliveryApi,DELIVERY_STATUS,type DeliveryJob,type DeliveryStatus} from '../deliveryApi'
import {PageHeader} from '../components/PageHeader'
import {AdvancedSearch} from '../components/AdvancedSearch'
import {ResponsiveDataView} from '../components/ResponsiveDataView'
import {RowActions} from '../components/RowActions'
import {useInfiniteRows} from '../hooks/useInfiniteRows'
import {DeliveryFields,DeliveryJobDetailPage,fromFields} from './DeliveryJobDetailPage'

const tomorrow=()=>{const d=new Date(Date.now()+86400000);d.setHours(9,0,0,0);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
const when=(v:string)=>new Date(v).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})
const customers=(x:DeliveryJob)=>x.customers.length?x.customers.length>2?x.customers.slice(0,2).join(', ')+' +'+(x.customers.length-2):x.customers.join(', '):'No packages yet'

/** Delivery register: each run opens in its own workspace. */
export function DeliveryJobsPage(){
 const [jobs,setJobs]=useState<DeliveryJob[]>([]),[query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState<DeliveryStatus>()
 const [createOpen,setCreateOpen]=useState(false),[saving,setSaving]=useState(false),[openId,setOpenId]=useState<string|null>(null)
 const [form]=Form.useForm()
 const load=()=>deliveryApi.list().then(setJobs).catch(e=>message.error(e instanceof Error?e.message:'Unable to load deliveries'))
 useEffect(()=>{void load()},[])
 const filtered=useMemo(()=>jobs.filter(x=>(!statusFilter||x.status===statusFilter)&&`${x.deliveryNumber} ${x.customers.join(' ')} ${x.vehicleName??''} ${x.driverName??''}`.toLowerCase().includes(query.toLowerCase())),[jobs,query,statusFilter])
 const {visibleRows,onScroll,hasMore}=useInfiniteRows(filtered,`${query}|${statusFilter}`)

 const openCreate=()=>{form.resetFields();form.setFieldsValue({scheduledAtLocal:tomorrow(),durationMinutes:240,notes:''});setCreateOpen(true)}
 const create=async()=>{
  const v=await form.validateFields();setSaving(true)
  try{const created=await deliveryApi.create(fromFields(v));setCreateOpen(false);await load();setOpenId(created.job.id);message.success('Delivery '+created.job.deliveryNumber+' created. Load the packages next.')}
  catch(e){message.error(e instanceof Error?e.message:'Unable to create the delivery')}finally{setSaving(false)}
 }

 if(openId)return <DeliveryJobDetailPage jobId={openId} onBack={()=>{setOpenId(null);void load()}} onChanged={()=>void load()}/>

 const tag=(x:DeliveryJob)=><Tag color={DELIVERY_STATUS[x.status].color}>{DELIVERY_STATUS[x.status].label}</Tag>
 const progress=(x:DeliveryJob)=>!x.itemCount?'—':<span>{x.deliveredCount}/{x.itemCount} delivered{x.returnedCount?<Tag color="volcano" style={{marginLeft:6}}>{x.returnedCount} not delivered</Tag>:null}</span>
 const columns:ColumnsType<DeliveryJob>=[
  {title:'Delivery',dataIndex:'deliveryNumber',width:240,render:(_,x)=><div className="primary-cell"><strong>{x.deliveryNumber}</strong><small>#{x.serialNo} · {customers(x)}</small></div>},
  {title:'Schedule',dataIndex:'scheduledAtUtc',width:180,render:(_,x)=>when(x.scheduledAtUtc)},
  {title:'Vehicle / driver',key:'vehicle',width:220,render:(_,x)=>x.vehicleName||x.driverName?<div className="primary-cell"><span>{x.vehicleName??'No vehicle'}</span><small>{x.driverName??'No driver'}</small></div>:'—'},
  {title:'Packages',key:'packages',width:200,render:(_,x)=>progress(x)},
  {title:'Signed notes',key:'notes',width:120,render:(_,x)=>x.noteCount?x.signedCount+'/'+x.noteCount:'—'},
  {title:'Distance',dataIndex:'distanceKm',width:100,render:(_,x)=>x.distanceKm!=null?x.distanceKm+' km':'—'},
  {title:'Status',dataIndex:'status',width:150,render:(_,x)=>tag(x)},
  {title:'Actions',key:'actions',width:80,render:(_,x)=><RowActions><Button size="small" onClick={()=>setOpenId(x.id)}>Open delivery</Button></RowActions>}
 ]

 return <div className="pickup-register-page">
  <PageHeader onRefresh={load} eyebrow="DELIVERY OPERATIONS" title="Delivery" description="Load packages from the warehouse or a job, assign crew, driver and vehicle, deliver each package, take customer signatures on delivery notes and record money collected and expenses." action="Create delivery" onAction={openCreate}
   filters={<AdvancedSearch value={query} onChange={setQuery} active={Boolean(statusFilter)} onReset={()=>{setQuery('');setStatusFilter(undefined)}}><Select allowClear placeholder="Status" value={statusFilter} onChange={setStatusFilter} options={(Object.keys(DELIVERY_STATUS) as DeliveryStatus[]).map(s=>({value:s,label:DELIVERY_STATUS[s].label}))}/></AdvancedSearch>}/>
  <Card className="grid-card" title="Delivery register" extra={`${filtered.length} deliveries`}>
   <ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} hasMore={hasMore} total={filtered.length} label="deliveries" scrollX={1290}
    renderTile={x=><><div className="tile-heading"><div className="primary-cell"><strong>{x.deliveryNumber}</strong><small>{customers(x)}</small></div>{tag(x)}</div>
     <div className="tile-details"><span>{when(x.scheduledAtUtc)}</span><span>{x.itemCount?x.deliveredCount+'/'+x.itemCount+' delivered':'No packages yet'}</span><span>{x.vehicleName??'No vehicle'} · {x.driverName??'No driver'}</span></div>
     <div className="tile-actions"><RowActions><Button size="small" onClick={()=>setOpenId(x.id)}>Open delivery</Button></RowActions></div></>}/>
  </Card>
  <Modal centered width={560} open={createOpen} title="Create delivery" okText="Create delivery" confirmLoading={saving} onOk={()=>void create()} onCancel={()=>setCreateOpen(false)} destroyOnHidden>
   <DeliveryFields form={form}/>
  </Modal>
 </div>
}
