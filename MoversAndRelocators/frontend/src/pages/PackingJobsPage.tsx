import {useEffect,useMemo,useState} from 'react'
import {Button,Card,Form,Modal,Segmented,Select,Tag,message} from 'antd'
import type {ColumnsType} from 'antd/es/table'
import {packingApi,STATUS_LABEL,type PackingJob,type PackingSource,type PackingStatus} from '../packingApi'
import {PageHeader} from '../components/PageHeader'
import {AdvancedSearch} from '../components/AdvancedSearch'
import {ResponsiveDataView} from '../components/ResponsiveDataView'
import {RowActions} from '../components/RowActions'
import {useInfiniteRows} from '../hooks/useInfiniteRows'
import {JobFields,PackingJobDetailPage} from './PackingJobDetailPage'

type Source='PICKUP'|'QUOTATION'|'DIRECT'
const tomorrow=()=>{const d=new Date(Date.now()+86400000);d.setHours(9,0,0,0);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
const plural=(n:number,one:string,many:string)=>n+' '+(n===1?one:many)
const when=(v:string)=>new Date(v).toLocaleString([],{dateStyle:'medium',timeStyle:'short'})

/** Packing register: packing jobs separate from pickups, each opening in its own workspace. */
export function PackingJobsPage(){
 const [jobs,setJobs]=useState<PackingJob[]>([]),[sources,setSources]=useState<PackingSource[]>([]),[query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState<PackingStatus>()
 const [createOpen,setCreateOpen]=useState(false),[source,setSource]=useState<Source>('PICKUP'),[sourceId,setSourceId]=useState<string>(),[saving,setSaving]=useState(false),[openId,setOpenId]=useState<string|null>(null)
 const [form]=Form.useForm()
 const load=()=>Promise.all([packingApi.list(),packingApi.sources()]).then(([a,b])=>{setJobs(a);setSources(b)}).catch(e=>message.error(e instanceof Error?e.message:'Unable to load packing jobs'))
 useEffect(()=>{void load()},[])
 const filtered=useMemo(()=>jobs.filter(x=>(!statusFilter||x.status===statusFilter)&&`${x.jobNumber} ${x.customerName} ${x.address} ${x.pickupNumber??''} ${x.quotationNumber??''}`.toLowerCase().includes(query.toLowerCase())),[jobs,query,statusFilter])
 const {visibleRows,onScroll,hasMore}=useInfiniteRows(filtered,`${query}|${statusFilter}`)

 const openCreate=()=>{form.resetFields();setSource('PICKUP');setSourceId(undefined);form.setFieldsValue({scheduledAtLocal:tomorrow(),email:'',notes:''});setCreateOpen(true)}
 const pick=(id:string)=>{const s=sources.find(x=>x.id===id);setSourceId(id);if(s)form.setFieldsValue({customerName:s.customerName,phone:s.phone,email:s.email??'',address:s.address})}
 const create=async()=>{
  if(source!=='DIRECT'&&!sourceId){message.error('Select the '+source.toLowerCase()+' to pack for.');return}
  const v=await form.validateFields();setSaving(true)
  const s=sources.find(x=>x.id===sourceId)
  try{
   const created=await packingApi.create({customerName:v.customerName,phone:v.phone,email:v.email||null,address:v.address,notes:v.notes||null,scheduledAtUtc:new Date(v.scheduledAtLocal).toISOString(),
    pickupId:source==='PICKUP'?sourceId:null,quotationId:source==='QUOTATION'?sourceId:s?.quotationId??null,salesLeadId:source==='DIRECT'?null:s?.salesLeadId??null})
   setCreateOpen(false);await load();setOpenId(created.job.id);message.success('Packing job '+created.job.jobNumber+' created')
  }catch(e){message.error(e instanceof Error?e.message:'Unable to create the packing job')}finally{setSaving(false)}
 }

 if(openId)return <PackingJobDetailPage jobId={openId} onBack={()=>{setOpenId(null);void load()}} onChanged={()=>void load()}/>

 const tag=(x:PackingJob)=><Tag color={STATUS_LABEL[x.status].color}>{STATUS_LABEL[x.status].label}</Tag>
 const origin=(x:PackingJob)=>x.pickupNumber?'Pickup '+x.pickupNumber:x.quotationNumber?'Quotation '+x.quotationNumber:x.leadNumber?'Lead '+x.leadNumber:'Direct'
 const columns:ColumnsType<PackingJob>=[
  {title:'Packing job',dataIndex:'jobNumber',width:240,render:(_,x)=><div className="primary-cell"><strong>{x.jobNumber}</strong><small>#{x.serialNo} · {x.customerName}</small></div>},
  {title:'Source',key:'source',width:200,render:(_,x)=>origin(x)},
  {title:'Schedule',dataIndex:'scheduledAtUtc',width:190,render:(_,x)=>when(x.scheduledAtUtc)},
  {title:'Boxes',dataIndex:'boxCount',width:90},
  {title:'Labels',key:'labels',width:150,render:(_,x)=>!x.boxCount?'—':x.labelsPending?<Tag color="orange">{x.labelsPending} to print</Tag>:<Tag color="green">All printed</Tag>},
  {title:'Status',dataIndex:'status',width:130,render:(_,x)=>tag(x)},
  {title:'Actions',key:'actions',width:80,render:(_,x)=><RowActions><Button size="small" onClick={()=>setOpenId(x.id)}>Open packing</Button></RowActions>}
 ]
 const options=sources.filter(s=>s.kind===source).map(s=>({value:s.id,label:s.number+' · '+s.customerName}))

 return <div className="pickup-register-page">
  <PageHeader onRefresh={load} eyebrow="PACKING OPERATIONS" title="Packing" description="Plan packing jobs, assign the crew, pack and label boxes, track materials used and record payments and expenses." action="Create packing job" onAction={openCreate}
   filters={<AdvancedSearch value={query} onChange={setQuery} active={Boolean(statusFilter)} onReset={()=>{setQuery('');setStatusFilter(undefined)}}><Select allowClear placeholder="Status" value={statusFilter} onChange={setStatusFilter} options={(Object.keys(STATUS_LABEL) as PackingStatus[]).map(s=>({value:s,label:STATUS_LABEL[s].label}))}/></AdvancedSearch>}/>
  <Card className="grid-card" title="Packing register" extra={`${filtered.length} jobs`}>
   <ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} hasMore={hasMore} total={filtered.length} label="packing jobs" scrollX={1080}
    renderTile={x=><><div className="tile-heading"><div className="primary-cell"><strong>{x.jobNumber}</strong><small>{x.customerName}</small></div>{tag(x)}</div>
     <div className="tile-details"><span>{when(x.scheduledAtUtc)}</span><span>{plural(x.boxCount,'box','boxes')}{x.labelsPending?' · '+plural(x.labelsPending,'label','labels')+' to print':''}</span><span>{origin(x)}</span></div>
     <div className="tile-actions"><RowActions><Button size="small" onClick={()=>setOpenId(x.id)}>Open packing</Button></RowActions></div></>}/>
  </Card>
  <Modal centered width={720} open={createOpen} title="Create packing job" okText="Create packing job" confirmLoading={saving} onOk={()=>void create()} onCancel={()=>setCreateOpen(false)} destroyOnHidden>
   <Segmented block style={{marginBottom:12}} value={source} onChange={v=>{setSource(v as Source);setSourceId(undefined)}} options={[{value:'PICKUP',label:'From pickup'},{value:'QUOTATION',label:'From quotation'},{value:'DIRECT',label:'Direct'}]}/>
   {source!=='DIRECT'&&<Select style={{width:'100%',marginBottom:16}} showSearch optionFilterProp="label" placeholder={'Search '+(source==='PICKUP'?'pickups':'quotations')} value={sourceId} onChange={pick} options={options} notFoundContent={'No '+source.toLowerCase()+'s found'}/>}
   <JobFields form={form}/>
  </Modal>
 </div>
}
