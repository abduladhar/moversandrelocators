import { nowLocal } from '../dates'
import { readable } from '../operationsApi'
import {ReportPrintButton} from '../reportingV2/ReportPrintButton'
import { BillingPanel } from '../components/BillingPanel'
import { useBilling } from '../billingApi'
import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Card, Descriptions, Form, Input, Modal, Select, Space, Tabs, Tag, message } from 'antd'
import { PlusOutlined, PrinterOutlined } from '@ant-design/icons'
import { request } from '../api'
import { jobApi, type Job, type JobDetails } from '../jobApi'
import { warehouseApi, type WarehouseStock } from '../warehouseApi'
import type { BusinessMaster } from '../businessMasters'
import { PageHeader } from '../components/PageHeader'
import { DataGrid } from '../components/DataGrid'
import { RowActions } from '../components/RowActions'
import { formatDateTime, has, useT } from '../i18n'
const MODES = ['AIR', 'OCEAN', 'ROAD'] as const
const editable = (j: Job) => ['DRAFT', 'LOADING'].includes(j.status)
const date = (v?: string) => v ? formatDateTime(v) : '—'
const localDate = (v?: string) => v ? new Date(new Date(v).getTime()-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16) : undefined
/** Transport fields per mode: [field, text key under operations.jobs.field]. */
const fields: Record<string, [keyof JobDetails, string][]> = {
 AIR: [['carrier','airline'],['flightNumber','flightNumber'],['airWaybill','airWaybill']],
 OCEAN: [['carrier','shippingLine'],['vesselName','vesselName'],['voyageNumber','voyageNumber'],['billOfLading','billOfLading'],['containerNumber','containerNumber'],['sealNumber','sealNumber']],
 ROAD: [['carrier','transportCompany'],['truckNumber','truckNumber'],['trailerNumber','trailerNumber'],['driverName','driverName'],['driverPhone','driverPhone'],['roadReference','roadReference']],
}
export function JobsPage({ companyName, userName }: { companyName: string; userName: string }) {
 const { t } = useT()
 const movement = (v: string) => has('operations.movement.'+v) ? t('operations.movement.'+v) : readable(v)
 const modeLabel = (v: string) => has('operations.mode.'+v) ? t('operations.mode.'+v) : v
 const fieldLabel = (key: string) => t('operations.jobs.field.'+key)
 const sourceLabel = (v: string) => has('warehouse.source.'+v) ? t('warehouse.source.'+v) : v
 const canBill=useBilling()
 const [jobs,setJobs]=useState<Job[]>([]), [selected,setSelected]=useState<Job>(), [agents,setAgents]=useState<BusinessMaster[]>([])
 const [query,setQuery]=useState(''), [loading,setLoading]=useState(false), [saving,setSaving]=useState(false)
 const [editor,setEditor]=useState(false), [editing,setEditing]=useState<Job>(), [loader,setLoader]=useState(false), [manifest,setManifest]=useState(false)
 const [stock,setStock]=useState<WarehouseStock[]>([]), [keys,setKeys]=useState<string[]>([]), [stockQuery,setStockQuery]=useState(''), [loadedBy,setLoadedBy]=useState(userName)
 const busy=useRef(false), requestId=useRef(''), [form]=Form.useForm<JobDetails>(), mode=Form.useWatch('mode',form) || 'AIR'
 const load = async () => {
  setLoading(true)
  try { const [j,a]=await Promise.all([jobApi.list(),request<BusinessMaster[]>('/api/business-masters/vendor/choices')]); setJobs(j); setAgents(a.filter(x=>x.isAgent)); if(selected) setSelected(j.find(x=>x.id===selected.id)) }
  catch(e){message.error(e instanceof Error?e.message:t('operations.jobs.loadFailed'))} finally {setLoading(false)}
 }
 useEffect(()=>{void load()},[])
 const mutate=async(action:()=>Promise<Job>,done?:()=>void)=>{
  if(busy.current)return; busy.current=true; setSaving(true)
  try {const j=await action();setSelected(j);setJobs(old=>[j,...old.filter(x=>x.id!==j.id)]);done?.();message.success(t('operations.jobs.saved'))}
  catch(e){message.error(e instanceof Error?e.message:t('operations.jobs.saveFailed'))}finally{busy.current=false;setSaving(false)}
 }
 const edit=(j?:Job)=>{setEditing(j);form.resetFields();form.setFieldsValue(j?{...j.details,estimatedDeparture:localDate(j.details.estimatedDeparture),estimatedArrival:localDate(j.details.estimatedArrival)}:{mode:'AIR',estimatedDeparture:nowLocal(),estimatedArrival:nowLocal()});requestId.current=crypto.randomUUID();setEditor(true)}
 const save=async()=>{try{const v=await form.validateFields();const d={...v,estimatedDeparture:v.estimatedDeparture?new Date(v.estimatedDeparture).toISOString():undefined,estimatedArrival:v.estimatedArrival?new Date(v.estimatedArrival).toISOString():undefined};await mutate(()=>editing?jobApi.edit(editing,d):jobApi.create(requestId.current,d),()=>setEditor(false))}catch{/* form displays validation */}}
 const openLoad=async()=>{
  setLoading(true);try{const s=await warehouseApi.stock();setStock(s);setKeys([]);setStockQuery('');setLoadedBy(userName);setLoader(true)}catch(e){message.error(e instanceof Error?e.message:t('operations.jobs.stockFailed'))}finally{setLoading(false)}
 }
 const confirm=(title:string, action:()=>Promise<Job>)=>Modal.confirm({title,content:t('operations.jobs.confirmContent'),okText:t('common.confirm'),cancelText:t('common.cancel'),onOk:()=>mutate(action)})
 const current=selected?.cargo.filter(x=>x.isActive)??[]
 const required=[{required:true,whitespace:true,message:t('common.required')}]
 return <>
 <PageHeader eyebrow={t('operations.jobs.eyebrow')} title={selected?selected.jobNumber:t('operations.jobs.title')} description={selected?t('operations.jobs.route',{origin:selected.details.originPort,destination:selected.details.destinationPort}):t('operations.jobs.description')} onRefresh={load} filters={<Input.Search aria-label={t('operations.jobs.search')} placeholder={t('operations.jobs.searchPlaceholder')} allowClear value={query} onChange={e=>setQuery(e.target.value)}/>} />
 {!selected ? <>
 <Button type="primary" icon={<PlusOutlined/>} onClick={()=>edit()} style={{marginBottom:16}}>{t('operations.jobs.create')}</Button>
 <Card title={t('operations.jobs.register')}><DataGrid<Job> rowKey="id" loading={loading} dataSource={jobs.filter(j=>[j.jobNumber,j.status,...Object.values(j.details)].join(' ').toLowerCase().includes(query.toLowerCase()))} columns={[
 {title:t('operations.jobs.col.job'),dataIndex:'jobNumber'}, {title:t('operations.jobs.col.mode'),dataIndex:['details','mode'],render:(v:string)=>modeLabel(v)}, {title:t('operations.jobs.col.originPort'),dataIndex:['details','originPort']}, {title:t('operations.jobs.col.destinationPort'),dataIndex:['details','destinationPort']},
 {title:t('operations.jobs.col.departure'),render:(_,j)=>date(j.details.estimatedDeparture)}, {title:t('operations.jobs.col.boxes'),render:(_,j)=>j.cargo.filter(x=>x.isActive).length}, {title:t('common.status'),dataIndex:'status',render:v=><Tag color="green">{movement(v)}</Tag>},
 {title:t('common.actions'),key:'actions',render:(_,j)=><RowActions><Button onClick={()=>setSelected(j)}>{t('common.open')}</Button>{editable(j)&&<Button onClick={()=>edit(j)}>{t('common.edit')}</Button>}</RowActions>}
 ]}/></Card></> : <>
 <Space wrap style={{marginBottom:16}}>
 <Button onClick={()=>setSelected(undefined)}>{t('operations.jobs.back')}</Button><Tag color="green">{movement(selected.status)}</Tag>
 {editable(selected)&&<><Button onClick={()=>edit(selected)}>{t('operations.jobs.edit')}</Button><Button type="primary" loading={loading} onClick={()=>void openLoad()}>{t('operations.jobs.loadBoxes')}</Button><Button disabled={!current.length||saving} onClick={()=>confirm(t('operations.jobs.departTitle'),()=>jobApi.step(selected,'depart'))}>{t('operations.jobs.markDeparted')}</Button>{!current.length&&<Button danger disabled={saving} onClick={()=>confirm(t('operations.jobs.cancelTitle'),()=>jobApi.step(selected,'cancel'))}>{t('operations.jobs.cancel')}</Button>}</>}
 {selected.status==='IN_TRANSIT'&&<Button type="primary" disabled={saving} onClick={()=>confirm(t('operations.jobs.arriveTitle'),()=>jobApi.step(selected,'arrive'))}>{t('operations.jobs.markArrived')}</Button>}
 <Button icon={<PrinterOutlined/>} onClick={()=>setManifest(true)}>{t('operations.jobs.manifest')}</Button>
 </Space>
 <Tabs items={[
 ...(canBill ? [{key:'billing',label:t('operations.jobs.billing'),children:<BillingPanel sourceKind='JOB' sourceId={selected.id} companyName={companyName}/>}]:[]),
 {key:'details',label:t('operations.jobs.transportDetails'),children:<Card><Descriptions bordered column={{xs:1,sm:2,lg:3}} items={[
 {key:'mode',label:t('operations.jobs.col.mode'),children:modeLabel(selected.details.mode)},
 {key:'origin',label:t('operations.jobs.originTerminal'),children:selected.details.originPort},{key:'destination',label:t('operations.jobs.destinationTerminal'),children:selected.details.destinationPort},
 {key:'oa',label:t('operations.jobs.originAgent'),children:selected.details.originAgentName||t('operations.jobs.notAssigned')},{key:'da',label:t('operations.jobs.destinationAgent'),children:selected.details.destinationAgentName||t('operations.jobs.notAssigned')},
 ...fields[selected.details.mode].map(([key,label])=>({key,label:fieldLabel(label),children:selected.details[key]||'—'})),
 {key:'etd',label:t('operations.jobs.etd'),children:date(selected.details.estimatedDeparture)},{key:'eta',label:t('operations.jobs.eta'),children:date(selected.details.estimatedArrival)},
 {key:'atd',label:t('operations.jobs.atd'),children:date(selected.departedAtUtc)},{key:'ata',label:t('operations.jobs.ata'),children:date(selected.arrivedAtUtc)},{key:'notes',label:t('common.notes'),children:selected.details.notes||'—'}
 ]}/></Card>},
 {key:'cargo',label:t('operations.jobs.loadedTab',{count:current.length}),children:<DataGrid rowKey="id" dataSource={current} columns={[
 {title:t('operations.jobs.col.box'),dataIndex:['details','box','trackingNumber']},{title:t('common.customer'),dataIndex:['details','box','customerName']},{title:t('operations.jobs.col.warehouse'),dataIndex:['details','box','location']},{title:t('operations.jobs.col.contents'),dataIndex:['details','box','contents']},{title:t('operations.jobs.col.loadedBy'),dataIndex:'loadedBy'},{title:t('operations.jobs.col.loadedAt'),dataIndex:'loadedAtUtc',render:date},
 {title:t('common.actions'),key:'actions',render:(_,c)=>editable(selected)?<RowActions><Button disabled={saving} onClick={()=>confirm(t('operations.jobs.returnTitle'),()=>jobApi.unload(selected,c.id))}>{t('operations.jobs.returnToWarehouse')}</Button></RowActions>:null}
 ]}/>},
 {key:'history',label:t('operations.jobs.returnedTab'),children:<DataGrid rowKey="id" dataSource={selected.cargo.filter(c=>!c.isActive)} columns={[{title:t('operations.jobs.col.box'),dataIndex:['details','box','trackingNumber']},{title:t('operations.jobs.col.warehouse'),dataIndex:['details','box','location']},{title:t('operations.jobs.col.returnedBy'),dataIndex:'unloadedBy'},{title:t('operations.jobs.col.returnedAt'),dataIndex:'unloadedAtUtc',render:date}]}/>}
 ]}/>
 </>}
 <Modal title={editing?t('operations.jobs.editTitle',{number:editing.jobNumber}):t('operations.jobs.create')} open={editor} onCancel={()=>!saving&&setEditor(false)} onOk={()=>void save()} confirmLoading={saving} okText={t('operations.jobs.saveJob')} cancelText={t('common.cancel')} width={820} destroyOnHidden>
 <Form form={form} layout="vertical">
 <div className="job-form-grid">
 <Form.Item name="mode" label={t('operations.jobs.transportMode')} rules={[{required:true,message:t('common.required')}]}><Select options={MODES.map(value=>({value,label:modeLabel(value)}))}/></Form.Item>
 <Form.Item name="originPort" label={t('operations.jobs.originTerminal')} rules={required}><Input maxLength={160}/></Form.Item>
 <Form.Item name="destinationPort" label={t('operations.jobs.destinationTerminal')} rules={required}><Input maxLength={160}/></Form.Item>
 {(['origin','destination'] as const).map(side=><Form.Item key={side} name={side==='origin'?'originAgentCode':'destinationAgentCode'} label={side==='origin'?t('operations.jobs.originAgentOptional'):t('operations.jobs.destinationAgentOptional')}><Select allowClear showSearch optionFilterProp="label" placeholder={t('operations.jobs.selectAgent')} options={agents.map(a=>({value:a.code,label:a.name}))}/></Form.Item>)}
 </div>
 <h3>{t('operations.jobs.modeSection.'+mode)}</h3>
 <div className="job-form-grid">
 {fields[mode].map(([key,label])=><Form.Item key={key} name={key} label={fieldLabel(label)}><Input maxLength={key==='driverPhone'?40:160}/></Form.Item>)}
 <Form.Item name="estimatedDeparture" label={t('operations.jobs.etd')}><Input type="datetime-local"/></Form.Item>
 <Form.Item name="estimatedArrival" label={t('operations.jobs.eta')}><Input type="datetime-local"/></Form.Item>
 </div>
 <Form.Item name="notes" label={t('common.notes')}><Input.TextArea maxLength={2000} showCount rows={3}/></Form.Item>
 <Alert type="info" showIcon title={mode==='AIR'?t('operations.jobs.requiredAir'):mode==='OCEAN'?t('operations.jobs.requiredOcean'):t('operations.jobs.requiredRoad')}/>
 </Form></Modal>
 <Modal title={t('operations.jobs.loadTitle')} open={loader} width={1000} onCancel={()=>!saving&&setLoader(false)} okText={t('operations.jobs.loadOk',{count:keys.length})} cancelText={t('common.cancel')} confirmLoading={saving} okButtonProps={{disabled:!keys.length||!loadedBy.trim()}} onOk={()=>selected&&void mutate(()=>jobApi.load(selected,keys,loadedBy),()=>setLoader(false))}>
 <Space wrap style={{marginBottom:16}}><Input aria-label={t('operations.jobs.col.loadedBy')} placeholder={t('operations.jobs.col.loadedBy')} maxLength={160} value={loadedBy} onChange={e=>setLoadedBy(e.target.value)}/><Input.Search aria-label={t('operations.jobs.stockSearch')} placeholder={t('operations.jobs.stockSearchPlaceholder')} allowClear value={stockQuery} onChange={e=>setStockQuery(e.target.value)}/></Space>
 <DataGrid<WarehouseStock> rowKey="id" rowSelection={{selectedRowKeys:keys,onChange:k=>setKeys(k.map(String)),preserveSelectedRowKeys:true}} dataSource={stock.filter(s=>[s.trackingNumber,s.customerName,s.location,s.contents].join(' ').toLowerCase().includes(stockQuery.toLowerCase()))} columns={[{title:t('operations.jobs.col.box'),dataIndex:'trackingNumber'},{title:t('common.customer'),dataIndex:'customerName'},{title:t('operations.jobs.col.warehouseRack'),dataIndex:'location'},{title:t('operations.jobs.col.source'),dataIndex:'source',render:(v:string)=>sourceLabel(v)},{title:t('operations.jobs.col.contents'),dataIndex:'contents'}]}/>
 <Alert type="info" title={t('operations.jobs.loadHint')}/>
 </Modal>
 <Modal title={t('operations.jobs.manifest')} open={manifest} onCancel={()=>setManifest(false)} width={1000} footer={<ReportPrintButton type="JOB_MANIFEST" title={selected?.jobNumber??t('operations.jobs.manifest')} id={selected?.id} disabled={!selected}/>}>
 {selected&&<article className="printable-doc warehouse-receipt"><header><h2>{companyName}</h2><h1>{t('operations.jobs.manifest')}</h1><p>{t('operations.jobs.manifestHeading',{number:selected.jobNumber,mode:modeLabel(selected.details.mode),status:movement(selected.status)})}</p></header><h3>{t('operations.jobs.route',{origin:selected.details.originPort,destination:selected.details.destinationPort})}</h3>
 <p>{t('operations.jobs.agents',{origin:selected.details.originAgentName||'—',destination:selected.details.destinationAgentName||'—'})}</p>
 <p>{fields[selected.details.mode].map(([k,l])=>t('operations.jobs.fieldValue',{label:fieldLabel(l),value:selected.details[k]||'—'})).join(' · ')}</p>
 <p>{t('operations.jobs.dates',{departure:date(selected.details.estimatedDeparture),arrival:date(selected.details.estimatedArrival)})}</p>
 <table className="packing-items-table"><thead><tr><th>{t('operations.jobs.thBox')}</th><th>{t('operations.jobs.col.contents')}</th><th>{t('operations.jobs.thShipper')}</th><th>{t('operations.jobs.thConsignee')}</th></tr></thead><tbody>{current.map(c=><tr key={c.id}><td>{c.details.box.trackingNumber}<br/>{c.details.box.customerName}</td><td style={{whiteSpace:'pre-wrap'}}>{c.details.box.contents}</td><td>{[c.details.shipping?.shipper?.name,c.details.shipping?.shipper?.phone,c.details.shipping?.shipper?.address].filter(Boolean).join(' · ')}</td><td>{[c.details.shipping?.consignee?.name,c.details.shipping?.consignee?.phone,c.details.shipping?.consignee?.address,c.details.shipping?.dropAddress].filter(Boolean).join(' · ')}</td></tr>)}</tbody></table><p>{t('operations.jobs.manifestFooter',{count:current.length,notes:selected.details.notes??''})}</p></article>}
 </Modal>
 </>
}
