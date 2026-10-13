import {useContext,useEffect,useMemo,useRef,useState} from 'react'
import {Alert,Button,Modal,Select,Space,Table,Tabs,Tag,Timeline,Tooltip,message} from 'antd'
import {AppstoreAddOutlined,CopyOutlined,DeleteOutlined,DownloadOutlined,EditOutlined,HistoryOutlined,PlusOutlined,StarOutlined,ThunderboltOutlined,UploadOutlined} from '@ant-design/icons'
import {BillingPermissions} from '../billingApi'
import {reportV2Api,type ReportTypeInfo,type TemplateHistory,type TemplateV2} from './api'
import {professionalLayout} from './engine/autoLayout'
import {layoutProblem} from './engine/validate'
import {ReportDesignerV2} from './ReportDesignerV2'
import {LetterheadSettings} from './LetterheadSettings'
import {formatDateTime,useT} from '../i18n'

/** History actions the API records (English codes) → designer.templates.historyActions.* */
const HISTORY_ACTIONS:Record<string,string>={'Created':'created','Saved':'saved','Flags changed':'flagsChanged','Default replaced':'defaultReplaced','Duplicated':'duplicated','Deleted':'deleted'}

/** Report designs: tenant letterhead, and per document type the V2 templates with the designer. */
export function ReportTemplatesPage(){
 const {t:tr}=useT()
 const permissions=useContext(BillingPermissions),canPublish=permissions.includes('reports.publish')
 const [tab,setTab]=useState('templates')
 const [types,setTypes]=useState<ReportTypeInfo[]>([]),[type,setType]=useState('INVOICE')
 const [rows,setRows]=useState<TemplateV2[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(''),[creating,setCreating]=useState(false),[error,setError]=useState('')
 const [editing,setEditing]=useState<{template?:TemplateV2}|null>(null),[history,setHistory]=useState<{name:string;items:TemplateHistory[]}|null>(null)
 const importer=useRef<HTMLInputElement>(null)
 const typeLabel=types.find(t=>t.type===type)?.label??type

 useEffect(()=>{reportV2Api.types().then(setTypes).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setRows(await reportV2Api.manage(type))}catch(e){setRows([]);setError(e instanceof Error?e.message:tr('designer.templates.loadFailed'))}finally{setLoading(false)}}
 useEffect(()=>{void load()},[type])

 const run=async(action:()=>Promise<unknown>,done:string)=>{try{await action();message.success(done);await load()}catch(e){message.error(e instanceof Error?e.message:tr('designer.templates.actionFailed'))}}
 const grouped=useMemo(()=>Object.entries(types.reduce<Record<string,ReportTypeInfo[]>>((g,t)=>((g[t.module]??=[]).push(t),g),{})).map(([label,items])=>({label,options:items.map(t=>({value:t.type,label:t.label}))})),[types])

 /** Standard layout built from the latest real record of the type, saved and made the default. */
 const createStandard=async(t:string,label:string)=>{
  const sample=await reportV2Api.sample(t).catch(()=>({}))
  let saved=await reportV2Api.save(undefined,{type:t,name:tr('designer.templates.standardName',{type:label}),layout:JSON.stringify(professionalLayout(t,sample)),listOnPrint:false})
  if(!saved.details.isDefault&&canPublish)saved=await reportV2Api.flags(saved.id,{version:saved.version,isDefault:true})
  return saved
 }
 const createDefault=()=>{
  const go=()=>run(async()=>{setCreating(true);try{const t=await createStandard(type,typeLabel);if(!t.details.isDefault)message.info(tr('designer.templates.askPublisher'))}finally{setCreating(false)}},tr('designer.templates.defaultCreated',{type:typeLabel}))
  if(rows.some(r=>r.details.isDefault))Modal.confirm({title:tr('designer.templates.newDefaultTitle',{type:typeLabel}),content:tr('designer.templates.newDefaultContent'),okText:tr('common.create'),onOk:go})
  else void go()
 }
 const createAllMissing=async()=>{
  setBusy(tr('designer.templates.checking'))
  try{
   const existing=new Set((await reportV2Api.manage()).map(t=>t.details.type))
   const missing=types.filter(t=>!existing.has(t.type))
   if(!missing.length){message.info(tr('designer.templates.allHaveTemplates'));return}
   for(const [i,t] of missing.entries()){setBusy(tr('designer.templates.creatingProgress',{current:i+1,total:missing.length,type:t.label}));await createStandard(t.type,t.label)}
   message.success(tr('designer.templates.createdAll',{count:missing.length}));await load()
  }catch(e){message.error(e instanceof Error?e.message:tr('designer.templates.createAllFailed'))}
  finally{setBusy('')}
 }
 const download=(t:TemplateV2)=>{
  const url=URL.createObjectURL(new Blob([JSON.stringify({type:t.details.type,name:t.details.name,layout:JSON.parse(t.details.layout)},null,2)],{type:'application/json'}))
  const a=document.createElement('a');a.href=url;a.download=t.details.name.replace(/[^\w-]+/g,'-')+'.report.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 const importFile=async(file?:File)=>{
  if(importer.current)importer.current.value=''
  if(!file)return
  try{
   if(file.size>4_000_000)throw new Error(tr('designer.templates.fileTooLarge'))
   const json=JSON.parse(await file.text()),layout=json.layout??json
   const problem=layoutProblem(layout);if(problem)throw new Error(problem)
   if(json.type&&json.type!==type&&!window.confirm(tr('designer.templates.otherTypeConfirm',{source:String(json.type),type:typeLabel})))return
   await run(()=>reportV2Api.save(undefined,{type,name:String(json.name||file.name.replace(/\.json$/i,'')).slice(0,120),layout:JSON.stringify(layout),listOnPrint:false}),tr('designer.templates.imported'))
  }catch(e){message.error(e instanceof Error?e.message:tr('designer.templates.chooseExport'))}
 }

 if(editing)return <ReportDesignerV2 type={type} typeLabel={typeLabel} template={editing.template} onClose={changed=>{setEditing(null);if(changed)void load()}}/>

 const templates=<>
  <Space wrap style={{marginBottom:16,width:'100%',justifyContent:'space-between'}}>
   <Space wrap><span>{tr('designer.templates.document')}</span><Select aria-label={tr('designer.templates.documentType')} showSearch optionFilterProp="label" style={{minWidth:320}} value={type} onChange={setType} options={grouped}/></Space>
   <Space wrap>
    <Tooltip title={tr('designer.templates.createDefaultTip')}><Button icon={<ThunderboltOutlined/>} loading={creating} disabled={!!busy||creating} onClick={createDefault}>{tr('designer.templates.createDefault')}</Button></Tooltip>
    <Button icon={<UploadOutlined/>} onClick={()=>importer.current?.click()}>{tr('designer.templates.import')}</Button>
    <Button type="primary" icon={<PlusOutlined/>} onClick={()=>setEditing({})}>{tr('designer.templates.newTemplate')}</Button>
   </Space>
  </Space>
  {busy&&<Alert type="info" showIcon title={busy} style={{marginBottom:16}}/>}
  {error&&<Alert type="error" showIcon title={error} style={{marginBottom:16}}/>}
  {!loading&&!rows.length&&!error&&<Alert type="info" showIcon style={{marginBottom:16}} title={tr('designer.templates.emptyTitle',{type:typeLabel})}
   description={tr('designer.templates.emptyDescription')}
   action={<Button size="small" type="primary" disabled={!!busy||creating} onClick={createDefault}>{tr('designer.templates.createDefault')}</Button>}/>}
  <Table<TemplateV2> rowKey="id" loading={loading} dataSource={rows} pagination={false} columns={[
   {title:tr('common.name'),render:(_,t)=><Space><a onClick={()=>setEditing({template:t})}>{t.details.name}</a>{t.details.isDefault&&<Tag color="green">{tr('designer.templates.defaultTag')}</Tag>}{t.details.listOnPrint&&<Tag>{tr('designer.templates.offeredTag')}</Tag>}</Space>},
   {title:tr('designer.templates.colLayout'),width:110,render:(_,t)=>{try{const mode=JSON.parse(t.details.layout).mode;return ['fixed','batch','flow'].includes(mode)?tr('designer.templates.layout.'+mode):''}catch{return ''}}},
   {title:tr('designer.templates.colRevision'),width:90,render:(_,t)=>'v'+t.details.revision},
   {title:tr('common.updatedAt'),width:180,render:(_,t)=>formatDateTime(t.details.updatedAt)},
   {title:'',width:330,render:(_,t)=><Space size={4} wrap>
    <Tooltip title={tr('common.edit')}><Button size="small" icon={<EditOutlined/>} onClick={()=>setEditing({template:t})}/></Tooltip>
    <Tooltip title={canPublish?tr('designer.templates.useAsDefault'):tr('designer.templates.needsPublish')}><Button size="small" icon={<StarOutlined/>} disabled={!canPublish||t.details.isDefault} onClick={()=>void run(()=>reportV2Api.flags(t.id,{version:t.version,isDefault:true}),tr('designer.templates.defaultChanged'))}/></Tooltip>
    <Button size="small" disabled={!canPublish} onClick={()=>void run(()=>reportV2Api.flags(t.id,{version:t.version,listOnPrint:!t.details.listOnPrint}),t.details.listOnPrint?tr('designer.templates.noLongerOffered'):tr('designer.templates.nowOffered'))}>{t.details.listOnPrint?tr('designer.templates.hideAtPrint'):tr('designer.templates.offerAtPrint')}</Button>
    <Tooltip title={tr('designer.templates.duplicate')}><Button size="small" icon={<CopyOutlined/>} onClick={()=>void run(()=>reportV2Api.duplicate(t.id),tr('designer.templates.duplicated'))}/></Tooltip>
    <Tooltip title={tr('designer.templates.exportJson')}><Button size="small" icon={<DownloadOutlined/>} onClick={()=>download(t)}/></Tooltip>
    <Tooltip title={tr('designer.templates.history')}><Button size="small" icon={<HistoryOutlined/>} onClick={()=>void reportV2Api.history(t.id).then(items=>setHistory({name:t.details.name,items})).catch(e=>message.error(e.message))}/></Tooltip>
    <Tooltip title={tr('common.delete')}><Button size="small" danger icon={<DeleteOutlined/>} onClick={()=>Modal.confirm({title:tr('designer.templates.deleteTitle',{name:t.details.name}),content:t.details.isDefault?tr('designer.templates.deleteDefaultContent'):tr('designer.templates.deleteContent'),okText:tr('common.delete'),okButtonProps:{danger:true},onOk:()=>run(()=>reportV2Api.remove(t.id),tr('designer.templates.deleted'))})}/></Tooltip>
   </Space>}
  ]}/>
  <div style={{marginTop:16}}><Button icon={<AppstoreAddOutlined/>} disabled={!!busy||creating} onClick={()=>Modal.confirm({title:tr('designer.templates.createAllTitle'),content:tr('designer.templates.createAllContent'),okText:tr('common.create'),onOk:createAllMissing})}>{tr('designer.templates.createAllButton')}</Button></div>
 </>

 return <div>
  <div className="page-heading"><div><h1>{tr('designer.templates.title')}</h1><p>{tr('designer.templates.intro')}</p></div></div>
  <input ref={importer} type="file" accept="application/json,.json" style={{display:'none'}} onChange={e=>void importFile(e.target.files?.[0])}/>
  <Tabs activeKey={tab} onChange={setTab} items={[{key:'templates',label:tr('designer.templates.tabTemplates'),children:templates},{key:'letterhead',label:tr('designer.templates.tabLetterhead'),children:<LetterheadSettings/>}]}/>
  <Modal title={tr('designer.templates.historyTitle',{name:history?.name??''})} open={!!history} footer={null} onCancel={()=>setHistory(null)}>
   <Timeline items={(history?.items??[]).map(h=>({children:<><b>{HISTORY_ACTIONS[h.action]?tr('designer.templates.historyActions.'+HISTORY_ACTIONS[h.action]):h.action}</b> · v{h.template.revision} · {formatDateTime(h.at)}{h.template.isDefault?' · '+tr('designer.templates.historyDefault'):''}</>}))}/>
  </Modal>
 </div>
}
