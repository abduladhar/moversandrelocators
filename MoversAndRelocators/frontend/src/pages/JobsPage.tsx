import { movementLabel } from '../operationsApi'
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
const modes = [{ value: 'AIR', label: 'Air' }, { value: 'OCEAN', label: 'Ocean' }, { value: 'ROAD', label: 'Road' }]
const editable = (j: Job) => ['DRAFT', 'LOADING'].includes(j.status)
const date = (v?: string) => v ? new Date(v).toLocaleString() : '—'
const localDate = (v?: string) => v ? new Date(new Date(v).getTime()-new Date(v).getTimezoneOffset()*60000).toISOString().slice(0,16) : undefined
const fields: Record<string, [keyof JobDetails, string][]> = {
 AIR: [['carrier','Airline'],['flightNumber','Flight number'],['airWaybill','Air waybill']],
 OCEAN: [['carrier','Shipping line'],['vesselName','Vessel name'],['voyageNumber','Voyage number'],['billOfLading','Bill of lading'],['containerNumber','Container number'],['sealNumber','Seal number']],
 ROAD: [['carrier','Transport company'],['truckNumber','Truck registration'],['trailerNumber','Trailer number'],['driverName','Driver name'],['driverPhone','Driver phone'],['roadReference','Road consignment reference']],
}
export function JobsPage({ companyName, userName }: { companyName: string; userName: string }) {
 const canBill=useBilling()
 const [jobs,setJobs]=useState<Job[]>([]), [selected,setSelected]=useState<Job>(), [agents,setAgents]=useState<BusinessMaster[]>([])
 const [query,setQuery]=useState(''), [loading,setLoading]=useState(false), [saving,setSaving]=useState(false)
 const [editor,setEditor]=useState(false), [editing,setEditing]=useState<Job>(), [loader,setLoader]=useState(false), [manifest,setManifest]=useState(false)
 const [stock,setStock]=useState<WarehouseStock[]>([]), [keys,setKeys]=useState<string[]>([]), [stockQuery,setStockQuery]=useState(''), [loadedBy,setLoadedBy]=useState(userName)
 const busy=useRef(false), requestId=useRef(''), [form]=Form.useForm<JobDetails>(), mode=Form.useWatch('mode',form) || 'AIR'
 const load = async () => {
  setLoading(true)
  try { const [j,a]=await Promise.all([jobApi.list(),request<BusinessMaster[]>('/api/business-masters/vendor/choices')]); setJobs(j); setAgents(a.filter(x=>x.isAgent)); if(selected) setSelected(j.find(x=>x.id===selected.id)) }
  catch(e){message.error(e instanceof Error?e.message:'Unable to load jobs')} finally {setLoading(false)}
 }
 useEffect(()=>{void load()},[])
 const mutate=async(action:()=>Promise<Job>,done?:()=>void)=>{
  if(busy.current)return; busy.current=true; setSaving(true)
  try {const j=await action();setSelected(j);setJobs(old=>[j,...old.filter(x=>x.id!==j.id)]);done?.();message.success('Job saved')}
  catch(e){message.error(e instanceof Error?e.message:'Unable to save job')}finally{busy.current=false;setSaving(false)}
 }
 const edit=(j?:Job)=>{setEditing(j);form.resetFields();form.setFieldsValue(j?{...j.details,estimatedDeparture:localDate(j.details.estimatedDeparture),estimatedArrival:localDate(j.details.estimatedArrival)}:{mode:'AIR'});requestId.current=crypto.randomUUID();setEditor(true)}
 const save=async()=>{try{const v=await form.validateFields();const d={...v,estimatedDeparture:v.estimatedDeparture?new Date(v.estimatedDeparture).toISOString():undefined,estimatedArrival:v.estimatedArrival?new Date(v.estimatedArrival).toISOString():undefined};await mutate(()=>editing?jobApi.edit(editing,d):jobApi.create(requestId.current,d),()=>setEditor(false))}catch{/* form displays validation */}}
 const openLoad=async()=>{
  setLoading(true);try{const s=await warehouseApi.stock();setStock(s);setKeys([]);setStockQuery('');setLoadedBy(userName);setLoader(true)}catch(e){message.error(e instanceof Error?e.message:'Unable to load stock')}finally{setLoading(false)}
 }
 const confirm=(title:string, action:()=>Promise<Job>)=>Modal.confirm({title,content:'This updates the job and its cargo records.',okText:'Confirm',onOk:()=>mutate(action)})
 const current=selected?.cargo.filter(x=>x.isActive)??[]
 return <>
 <PageHeader eyebrow="PORT TO PORT OPERATIONS" title={selected?selected.jobNumber:'Jobs'} description={selected?selected.details.originPort+' → '+selected.details.destinationPort:'Load warehouse boxes onto Air, Ocean or Road jobs.'} onRefresh={load} filters={<Input.Search aria-label="Search jobs" placeholder="Job, route, agent or mode" allowClear value={query} onChange={e=>setQuery(e.target.value)}/>} />
 {!selected ? <>
 <Button type="primary" icon={<PlusOutlined/>} onClick={()=>edit()} style={{marginBottom:16}}>Create job</Button>
 <Card title="Job register"><DataGrid<Job> rowKey="id" loading={loading} dataSource={jobs.filter(j=>[j.jobNumber,j.status,...Object.values(j.details)].join(' ').toLowerCase().includes(query.toLowerCase()))} columns={[
 {title:'Job',dataIndex:'jobNumber'}, {title:'Mode',dataIndex:['details','mode']}, {title:'Origin port',dataIndex:['details','originPort']}, {title:'Destination port',dataIndex:['details','destinationPort']},
 {title:'Departure',render:(_,j)=>date(j.details.estimatedDeparture)}, {title:'Boxes',render:(_,j)=>j.cargo.filter(x=>x.isActive).length}, {title:'Status',dataIndex:'status',render:v=><Tag color="green">{movementLabel(v)}</Tag>},
 {title:'Actions',key:'actions',render:(_,j)=><RowActions><Button onClick={()=>setSelected(j)}>Open</Button>{editable(j)&&<Button onClick={()=>edit(j)}>Edit</Button>}</RowActions>}
 ]}/></Card></> : <>
 <Space wrap style={{marginBottom:16}}>
 <Button onClick={()=>setSelected(undefined)}>Back to jobs</Button><Tag color="green">{movementLabel(selected.status)}</Tag>
 {editable(selected)&&<><Button onClick={()=>edit(selected)}>Edit job</Button><Button type="primary" loading={loading} onClick={()=>void openLoad()}>Load warehouse boxes</Button><Button disabled={!current.length||saving} onClick={()=>confirm('Mark job as departed?',()=>jobApi.step(selected,'depart'))}>Mark departed</Button>{!current.length&&<Button danger disabled={saving} onClick={()=>confirm('Cancel this empty job?',()=>jobApi.step(selected,'cancel'))}>Cancel job</Button>}</>}
 {selected.status==='IN_TRANSIT'&&<Button type="primary" disabled={saving} onClick={()=>confirm('Confirm arrival at destination port?',()=>jobApi.step(selected,'arrive'))}>Mark arrived</Button>}
 <Button icon={<PrinterOutlined/>} onClick={()=>setManifest(true)}>Cargo manifest</Button>
 </Space>
 <Tabs items={[
 ...(canBill ? [{key:'billing',label:'Invoicing & billing',children:<BillingPanel sourceKind='JOB' sourceId={selected.id} companyName={companyName}/>}]:[]),
 {key:'details',label:'Transport details',children:<Card><Descriptions bordered column={{xs:1,sm:2,lg:3}} items={[
 {key:'mode',label:'Mode',children:selected.details.mode},
 {key:'origin',label:'Origin port / terminal',children:selected.details.originPort},{key:'destination',label:'Destination port / terminal',children:selected.details.destinationPort},
 {key:'oa',label:'Origin agent',children:selected.details.originAgentName||'Not assigned'},{key:'da',label:'Destination agent',children:selected.details.destinationAgentName||'Not assigned'},
 ...fields[selected.details.mode].map(([key,label])=>({key,label,children:selected.details[key]||'—'})),
 {key:'etd',label:'Estimated departure',children:date(selected.details.estimatedDeparture)},{key:'eta',label:'Estimated arrival',children:date(selected.details.estimatedArrival)},
 {key:'atd',label:'Actual departure',children:date(selected.departedAtUtc)},{key:'ata',label:'Actual arrival',children:date(selected.arrivedAtUtc)},{key:'notes',label:'Notes',children:selected.details.notes||'—'}
 ]}/></Card>},
 {key:'cargo',label:'Loaded boxes ('+current.length+')',children:<DataGrid rowKey="id" dataSource={current} columns={[
 {title:'Box',dataIndex:['details','box','trackingNumber']},{title:'Customer',dataIndex:['details','box','customerName']},{title:'Warehouse',dataIndex:['details','box','location']},{title:'Contents',dataIndex:['details','box','contents']},{title:'Loaded by',dataIndex:'loadedBy'},{title:'Loaded at',dataIndex:'loadedAtUtc',render:date},
 {title:'Actions',key:'actions',render:(_,c)=>editable(selected)?<RowActions><Button disabled={saving} onClick={()=>confirm('Return this box to its original warehouse?',()=>jobApi.unload(selected,c.id))}>Return to warehouse</Button></RowActions>:null}
 ]}/>},
 {key:'history',label:'Returned boxes',children:<DataGrid rowKey="id" dataSource={selected.cargo.filter(c=>!c.isActive)} columns={[{title:'Box',dataIndex:['details','box','trackingNumber']},{title:'Warehouse',dataIndex:['details','box','location']},{title:'Returned by',dataIndex:'unloadedBy'},{title:'Returned at',dataIndex:'unloadedAtUtc',render:date}]}/>}
 ]}/>
 </>}
 <Modal title={editing?'Edit '+editing.jobNumber:'Create job'} open={editor} onCancel={()=>!saving&&setEditor(false)} onOk={()=>void save()} confirmLoading={saving} okText="Save job" width={820} destroyOnHidden>
 <Form form={form} layout="vertical">
 <div className="job-form-grid">
 <Form.Item name="mode" label="Transportation mode" rules={[{required:true}]}><Select options={modes}/></Form.Item>
 <Form.Item name="originPort" label="Origin port / terminal" rules={[{required:true,whitespace:true}]}><Input maxLength={160}/></Form.Item>
 <Form.Item name="destinationPort" label="Destination port / terminal" rules={[{required:true,whitespace:true}]}><Input maxLength={160}/></Form.Item>
 {(['origin','destination'] as const).map(side=><Form.Item key={side} name={side==='origin'?'originAgentCode':'destinationAgentCode'} label={(side==='origin'?'Origin':'Destination')+' agent (optional)'}><Select allowClear showSearch optionFilterProp="label" placeholder="Select agent vendor" options={agents.map(a=>({value:a.code,label:a.name}))}/></Form.Item>)}
 </div>
 <h3>{modes.find(m=>m.value===mode)?.label} transportation</h3>
 <div className="job-form-grid">
 {fields[mode].map(([key,label])=><Form.Item key={key} name={key} label={label}><Input maxLength={key==='driverPhone'?40:160}/></Form.Item>)}
 <Form.Item name="estimatedDeparture" label="Estimated departure"><Input type="datetime-local"/></Form.Item>
 <Form.Item name="estimatedArrival" label="Estimated arrival"><Input type="datetime-local"/></Form.Item>
 </div>
 <Form.Item name="notes" label="Notes"><Input.TextArea maxLength={2000} showCount rows={3}/></Form.Item>
 <Alert type="info" showIcon title={mode==='AIR'?'Airline and flight number are required before departure.':mode==='OCEAN'?'Vessel and voyage number are required before departure.':'Truck registration and driver name are required before departure.'}/>
 </Form></Modal>
 <Modal title="Load from warehouse" open={loader} width={1000} onCancel={()=>!saving&&setLoader(false)} okText={'Load '+keys.length+' boxes'} confirmLoading={saving} okButtonProps={{disabled:!keys.length||!loadedBy.trim()}} onOk={()=>selected&&void mutate(()=>jobApi.load(selected,keys,loadedBy),()=>setLoader(false))}>
 <Space wrap style={{marginBottom:16}}><Input aria-label="Loaded by" placeholder="Loaded by" maxLength={160} value={loadedBy} onChange={e=>setLoadedBy(e.target.value)}/><Input.Search aria-label="Search available warehouse boxes" placeholder="Warehouse, customer or box" allowClear value={stockQuery} onChange={e=>setStockQuery(e.target.value)}/></Space>
 <DataGrid<WarehouseStock> rowKey="id" rowSelection={{selectedRowKeys:keys,onChange:k=>setKeys(k.map(String)),preserveSelectedRowKeys:true}} dataSource={stock.filter(s=>[s.trackingNumber,s.customerName,s.location,s.contents].join(' ').toLowerCase().includes(stockQuery.toLowerCase()))} columns={[{title:'Box',dataIndex:'trackingNumber'},{title:'Customer',dataIndex:'customerName'},{title:'Warehouse / rack',dataIndex:'location'},{title:'Source',dataIndex:'source'},{title:'Contents',dataIndex:'contents'}]}/>
 <Alert type="info" title="Only available warehouse boxes are shown. Loaded boxes remain assigned to this job until returned before departure."/>
 </Modal>
 <Modal title="Cargo manifest" open={manifest} onCancel={()=>setManifest(false)} width={1000} footer={<ReportPrintButton type="JOB_MANIFEST" title={selected?.jobNumber??"Cargo manifest"} id={selected?.id} disabled={!selected}/>}>
 {selected&&<article className="printable-doc warehouse-receipt"><header><h2>{companyName}</h2><h1>Cargo manifest</h1><p>{selected.jobNumber} · {selected.details.mode} · {selected.status}</p></header><h3>{selected.details.originPort} → {selected.details.destinationPort}</h3>
 <p>Origin agent: {selected.details.originAgentName||'—'} · Destination agent: {selected.details.destinationAgentName||'—'}</p>
 <p>{fields[selected.details.mode].map(([k,l])=>l+': '+(selected.details[k]||'—')).join(' · ')}</p>
 <p>Departure: {date(selected.details.estimatedDeparture)} · Arrival: {date(selected.details.estimatedArrival)}</p>
 <table className="packing-items-table"><thead><tr><th>Box / customer</th><th>Contents</th><th>Shipper</th><th>Consignee / delivery</th></tr></thead><tbody>{current.map(c=><tr key={c.id}><td>{c.details.box.trackingNumber}<br/>{c.details.box.customerName}</td><td style={{whiteSpace:'pre-wrap'}}>{c.details.box.contents}</td><td>{[c.details.shipping?.shipper?.name,c.details.shipping?.shipper?.phone,c.details.shipping?.shipper?.address].filter(Boolean).join(' · ')}</td><td>{[c.details.shipping?.consignee?.name,c.details.shipping?.consignee?.phone,c.details.shipping?.consignee?.address,c.details.shipping?.dropAddress].filter(Boolean).join(' · ')}</td></tr>)}</tbody></table><p>{current.length} boxes · {selected.details.notes}</p></article>}
 </Modal>
 </>
}


