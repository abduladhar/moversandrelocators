import { nowLocal } from '../dates'
import {useState} from 'react'
import {Button,Card,Form,Modal,Select,Tag,message} from 'antd'
import type {ColumnsType} from 'antd/es/table'
import {deliveryApi,DELIVERY_STATUS,type DeliveryJob,type DeliveryStatus} from '../deliveryApi'
import {PageHeader} from '../components/PageHeader'
import {AdvancedSearch} from '../components/AdvancedSearch'
import {ResponsiveDataView} from '../components/ResponsiveDataView'
import {RowActions} from '../components/RowActions'
import {CustomerReplyTag,CustomerStateFilter,useCustomerReplies} from '../components/CustomerReplyTag'
import {useServerList} from '../hooks/useServerList'
import type {SortDirection} from '../utils/sortRecords'
import {formatDateTime,useT} from '../i18n'
import {DeliveryFields,DeliveryJobDetailPage,fromFields} from './DeliveryJobDetailPage'

const when=(v:string)=>formatDateTime(v)

/** Delivery register: each run opens in its own workspace. */
export function DeliveryJobsPage(){
 const {t}=useT()
 const [query,setQuery]=useState(''),[statusFilter,setStatusFilter]=useState<DeliveryStatus>()
 const [sortField,setSortField]=useState('serialNo'),[direction,setDirection]=useState<SortDirection>('desc')
 const [createOpen,setCreateOpen]=useState(false),[saving,setSaving]=useState(false),[openId,setOpenId]=useState<string|null>(null)
 const [form]=Form.useForm()
 const customer=useCustomerReplies('DELIVERY_JOB'),[customerState,setCustomerState]=useState<string>()
 const list=useServerList(deliveryApi.search,{search:query,status:statusFilter,customerState,sort:sortField,desc:direction==='desc'},{failMessage:t('delivery.list.loadFailed')})
 // A handled reply can move the row out of the customer-state filter, so the list is fetched again then.
 const customerChanged = () => { void customer.reload(); if (customerState) void list.reload() }
 const load=()=>{void customer.reload();return list.reload()}
 const customers=(x:DeliveryJob)=>x.customers.length?x.customers.length>2?t('delivery.list.moreCustomers',{names:x.customers.slice(0,2).join(', '),count:x.customers.length-2}):x.customers.join(', '):t('delivery.list.noPackages')

 const openCreate=()=>{form.resetFields();form.setFieldsValue({scheduledAtLocal: nowLocal(),durationMinutes:240,notes:''});setCreateOpen(true)}
 const create=async()=>{
  const v=await form.validateFields();setSaving(true)
  try{const created=await deliveryApi.create(fromFields(v));setCreateOpen(false);await load();setOpenId(created.job.id);message.success(t('delivery.list.created',{number:created.job.deliveryNumber}))}
  catch(e){message.error(e instanceof Error?e.message:t('delivery.list.createFailed'))}finally{setSaving(false)}
 }

 if(openId)return <DeliveryJobDetailPage jobId={openId} onBack={()=>{setOpenId(null);void load()}} onChanged={()=>void load()}/>

 const tag=(x:DeliveryJob)=><span className="status-stack"><Tag color={DELIVERY_STATUS[x.status].color}>{t('delivery.status.'+x.status)}</Tag><CustomerReplyTag reply={customer.get(x.id)} onChanged={customerChanged}/></span>
 const progress=(x:DeliveryJob)=>!x.itemCount?'—':<span>{t('delivery.list.deliveredProgress',{delivered:x.deliveredCount,total:x.itemCount})}{x.returnedCount?<Tag color="volcano" style={{marginInlineStart:6}}>{t('delivery.list.notDeliveredCount',{count:x.returnedCount})}</Tag>:null}</span>
 const columns:ColumnsType<DeliveryJob>=[
  {title:t('delivery.list.col.delivery'),dataIndex:'deliveryNumber',width:240,render:(_,x)=><div className="primary-cell"><strong>{x.deliveryNumber}</strong><small>#{x.serialNo} · {customers(x)}</small></div>},
  {title:t('delivery.list.col.schedule'),dataIndex:'scheduledAtUtc',width:180,render:(_,x)=>when(x.scheduledAtUtc)},
  {title:t('delivery.list.col.vehicleDriver'),key:'vehicle',width:220,render:(_,x)=>x.vehicleName||x.driverName?<div className="primary-cell"><span>{x.vehicleName??t('delivery.list.noVehicle')}</span><small>{x.driverName??t('delivery.list.noDriver')}</small></div>:'—'},
  {title:t('delivery.list.col.packages'),key:'packages',width:200,render:(_,x)=>progress(x)},
  {title:t('delivery.list.col.signedNotes'),key:'notes',width:120,render:(_,x)=>x.noteCount?x.signedCount+'/'+x.noteCount:'—'},
  {title:t('delivery.list.col.distance'),dataIndex:'distanceKm',width:100,render:(_,x)=>x.distanceKm!=null?t('delivery.km',{value:x.distanceKm}):'—'},
  {title:t('common.status'),dataIndex:'status',width:150,render:(_,x)=>tag(x)},
  {title:t('common.actions'),key:'actions',width:80,render:(_,x)=><RowActions><Button size="small" onClick={()=>setOpenId(x.id)}>{t('delivery.list.open')}</Button></RowActions>}
 ]

 return <div className="pickup-register-page">
  <PageHeader onRefresh={load} eyebrow={t('delivery.list.eyebrow')} title={t('delivery.list.title')} description={t('delivery.list.description')} action={t('delivery.list.create')} onAction={openCreate}
   filters={<AdvancedSearch value={query} onChange={setQuery} active={Boolean(statusFilter)||Boolean(customerState)||sortField!=='serialNo'||direction!=='desc'} sortField={sortField} onSortField={setSortField} sortDirection={direction} onSortDirection={setDirection}
    sortOptions={[{value:'serialNo',label:t('common.createdAt')},{value:'scheduledAtUtc',label:t('delivery.list.col.schedule')},{value:'deliveryNumber',label:t('delivery.list.col.delivery')},{value:'status',label:t('common.status')}]}
    onReset={()=>{setQuery('');setStatusFilter(undefined);setCustomerState(undefined);setSortField('serialNo');setDirection('desc')}}><CustomerStateFilter value={customerState} onChange={setCustomerState}/><Select allowClear placeholder={t('common.status')} value={statusFilter} onChange={setStatusFilter} options={(Object.keys(DELIVERY_STATUS) as DeliveryStatus[]).map(s=>({value:s,label:t('delivery.status.'+s)}))}/></AdvancedSearch>}/>
  <Card className="grid-card" title={t('delivery.list.register')} extra={t('delivery.list.count',{count:list.total})}>
   <ResponsiveDataView rowKey="id" columns={columns} data={list.rows} onScroll={list.onScroll} hasMore={list.hasMore} total={list.total} loading={list.loading} label={t('delivery.list.unit')} scrollX={1290}
    renderTile={x=><><div className="tile-heading"><div className="primary-cell"><strong>{x.deliveryNumber}</strong><small>{customers(x)}</small></div>{tag(x)}</div>
     <div className="tile-details"><span>{when(x.scheduledAtUtc)}</span><span>{x.itemCount?t('delivery.list.deliveredProgress',{delivered:x.deliveredCount,total:x.itemCount}):t('delivery.list.noPackages')}</span><span>{x.vehicleName??t('delivery.list.noVehicle')} · {x.driverName??t('delivery.list.noDriver')}</span></div>
     <div className="tile-actions"><RowActions><Button size="small" onClick={()=>setOpenId(x.id)}>{t('delivery.list.open')}</Button></RowActions></div></>}/>
  </Card>
  <Modal centered width={560} open={createOpen} title={t('delivery.list.create')} okText={t('delivery.list.create')} cancelText={t('common.cancel')} confirmLoading={saving} onOk={()=>void create()} onCancel={()=>setCreateOpen(false)} destroyOnHidden>
   <DeliveryFields form={form}/>
  </Modal>
 </div>
}
