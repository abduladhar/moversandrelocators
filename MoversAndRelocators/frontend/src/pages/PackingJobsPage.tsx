import { nowLocal } from '../dates'
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
import {formatDateTime,useT} from '../i18n'

type Source='PICKUP'|'QUOTATION'|'DIRECT'
const when=(v:string)=>formatDateTime(v)

/** Packing register: packing jobs separate from pickups, each opening in its own workspace. */
export function PackingJobsPage(){
 const [jobs,setJobs]=useState<PackingJob[]>([]),[sources,setSources]=useState<PackingSource[]>([]),[query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState<PackingStatus>()
 const [createOpen,setCreateOpen]=useState(false),[source,setSource]=useState<Source>('PICKUP'),[sourceId,setSourceId]=useState<string>(),[saving,setSaving]=useState(false),[openId,setOpenId]=useState<string|null>(null)
 const [form]=Form.useForm()
 const {t}=useT()
 const statusLabel=(s:PackingStatus)=>t('packing.status.'+s)
 const load=()=>Promise.all([packingApi.list(),packingApi.sources()]).then(([a,b])=>{setJobs(a);setSources(b)}).catch(e=>message.error(e instanceof Error?e.message:t('packing.list.loadFailed')))
 useEffect(()=>{void load()},[])
 const filtered=useMemo(()=>jobs.filter(x=>(!statusFilter||x.status===statusFilter)&&`${x.jobNumber} ${x.customerName} ${x.address} ${x.pickupNumber??''} ${x.quotationNumber??''}`.toLowerCase().includes(query.toLowerCase())),[jobs,query,statusFilter])
 const {visibleRows,onScroll,hasMore}=useInfiniteRows(filtered,`${query}|${statusFilter}`)

 const openCreate=()=>{form.resetFields();setSource('PICKUP');setSourceId(undefined);form.setFieldsValue({scheduledAtLocal: nowLocal(),email:'',notes:''});setCreateOpen(true)}
 const pick=(id:string)=>{const s=sources.find(x=>x.id===id);setSourceId(id);if(s)form.setFieldsValue({customerName:s.customerName,phone:s.phone,email:s.email??'',address:s.address})}
 const create=async()=>{
  if(source!=='DIRECT'&&!sourceId){message.error(source==='PICKUP'?t('packing.list.selectPickup'):t('packing.list.selectQuotation'));return}
  const v=await form.validateFields();setSaving(true)
  const s=sources.find(x=>x.id===sourceId)
  try{
   const created=await packingApi.create({customerName:v.customerName,phone:v.phone,email:v.email||null,address:v.address,notes:v.notes||null,scheduledAtUtc:new Date(v.scheduledAtLocal).toISOString(),
    pickupId:source==='PICKUP'?sourceId:null,quotationId:source==='QUOTATION'?sourceId:s?.quotationId??null,salesLeadId:source==='DIRECT'?null:s?.salesLeadId??null})
   setCreateOpen(false);await load();setOpenId(created.job.id);message.success(t('packing.list.created',{number:created.job.jobNumber}))
  }catch(e){message.error(e instanceof Error?e.message:t('packing.list.createFailed'))}finally{setSaving(false)}
 }

 if(openId)return <PackingJobDetailPage jobId={openId} onBack={()=>{setOpenId(null);void load()}} onChanged={()=>void load()}/>

 const tag=(x:PackingJob)=><Tag color={STATUS_LABEL[x.status].color}>{statusLabel(x.status)}</Tag>
 const origin=(x:PackingJob)=>x.pickupNumber?t('packing.pickupNumber',{number:x.pickupNumber}):x.quotationNumber?t('packing.quotationNumber',{number:x.quotationNumber}):x.leadNumber?t('packing.leadNumber',{number:x.leadNumber}):t('packing.direct')
 const columns:ColumnsType<PackingJob>=[
  {title:t('packing.list.colJob'),dataIndex:'jobNumber',width:240,render:(_,x)=><div className="primary-cell"><strong>{x.jobNumber}</strong><small>#{x.serialNo} · {x.customerName}</small></div>},
  {title:t('packing.list.colSource'),key:'source',width:200,render:(_,x)=>origin(x)},
  {title:t('packing.list.colSchedule'),dataIndex:'scheduledAtUtc',width:190,render:(_,x)=>when(x.scheduledAtUtc)},
  {title:t('packing.boxes'),dataIndex:'boxCount',width:90},
  {title:t('packing.list.colLabels'),key:'labels',width:150,render:(_,x)=>!x.boxCount?'—':x.labelsPending?<Tag color="orange">{t('packing.list.toPrint',{count:x.labelsPending})}</Tag>:<Tag color="green">{t('packing.list.allPrinted')}</Tag>},
  {title:t('common.status'),dataIndex:'status',width:130,render:(_,x)=>tag(x)},
  {title:t('common.actions'),key:'actions',width:80,render:(_,x)=><RowActions><Button size="small" onClick={()=>setOpenId(x.id)}>{t('packing.list.open')}</Button></RowActions>}
 ]
 const options=sources.filter(s=>s.kind===source).map(s=>({value:s.id,label:s.number+' · '+s.customerName}))

 return <div className="pickup-register-page">
  <PageHeader onRefresh={load} eyebrow={t('packing.list.eyebrow')} title={t('packing.list.title')} description={t('packing.list.description')} action={t('packing.list.create')} onAction={openCreate}
   filters={<AdvancedSearch value={query} onChange={setQuery} active={Boolean(statusFilter)} onReset={()=>{setQuery('');setStatusFilter(undefined)}}><Select allowClear placeholder={t('common.status')} value={statusFilter} onChange={setStatusFilter} options={(Object.keys(STATUS_LABEL) as PackingStatus[]).map(s=>({value:s,label:statusLabel(s)}))}/></AdvancedSearch>}/>
  <Card className="grid-card" title={t('packing.list.register')} extra={t('packing.list.count',{count:filtered.length})}>
   <ResponsiveDataView rowKey="id" columns={columns} data={visibleRows} onScroll={onScroll} hasMore={hasMore} total={filtered.length} label={t('packing.list.rowsLabel')} scrollX={1080}
    renderTile={x=><><div className="tile-heading"><div className="primary-cell"><strong>{x.jobNumber}</strong><small>{x.customerName}</small></div>{tag(x)}</div>
     <div className="tile-details"><span>{when(x.scheduledAtUtc)}</span><span>{t('packing.boxCount',{count:x.boxCount})}{x.labelsPending?' · '+t('packing.list.labelsToPrint',{count:x.labelsPending}):''}</span><span>{origin(x)}</span></div>
     <div className="tile-actions"><RowActions><Button size="small" onClick={()=>setOpenId(x.id)}>{t('packing.list.open')}</Button></RowActions></div></>}/>
  </Card>
  <Modal centered width={720} open={createOpen} title={t('packing.list.create')} okText={t('packing.list.create')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={()=>void create()} onCancel={()=>setCreateOpen(false)} destroyOnHidden>
   <Segmented block style={{marginBottom:12}} value={source} onChange={v=>{setSource(v as Source);setSourceId(undefined)}} options={[{value:'PICKUP',label:t('packing.list.fromPickup')},{value:'QUOTATION',label:t('packing.list.fromQuotation')},{value:'DIRECT',label:t('packing.direct')}]}/>
   {source!=='DIRECT'&&<Select style={{width:'100%',marginBottom:16}} showSearch optionFilterProp="label" placeholder={source==='PICKUP'?t('packing.list.searchPickups'):t('packing.list.searchQuotations')} value={sourceId} onChange={pick} options={options} notFoundContent={source==='PICKUP'?t('packing.list.noPickups'):t('packing.list.noQuotations')}/>}
   <JobFields form={form}/>
  </Modal>
 </div>
}
