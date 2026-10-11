import {useContext,useEffect,useMemo,useRef,useState} from 'react'
import {Alert,Button,Modal,Select,Space,Table,Tabs,Tag,Timeline,Tooltip,message} from 'antd'
import {AppstoreAddOutlined,CopyOutlined,DeleteOutlined,DownloadOutlined,EditOutlined,HistoryOutlined,PlusOutlined,StarOutlined,ThunderboltOutlined,UploadOutlined} from '@ant-design/icons'
import {BillingPermissions} from '../billingApi'
import {reportV2Api,type ReportTypeInfo,type TemplateHistory,type TemplateV2} from './api'
import {professionalLayout} from './engine/autoLayout'
import {layoutProblem} from './engine/validate'
import {ReportDesignerV2} from './ReportDesignerV2'
import {LetterheadSettings} from './LetterheadSettings'

/** Report designs: tenant letterhead, and per document type the V2 templates with the designer. */
export function ReportTemplatesPage(){
 const permissions=useContext(BillingPermissions),canPublish=permissions.includes('reports.publish')
 const [tab,setTab]=useState('templates')
 const [types,setTypes]=useState<ReportTypeInfo[]>([]),[type,setType]=useState('INVOICE')
 const [rows,setRows]=useState<TemplateV2[]>([]),[loading,setLoading]=useState(false),[busy,setBusy]=useState(''),[error,setError]=useState('')
 const [editing,setEditing]=useState<{template?:TemplateV2}|null>(null),[history,setHistory]=useState<{name:string;items:TemplateHistory[]}|null>(null)
 const importer=useRef<HTMLInputElement>(null)
 const typeLabel=types.find(t=>t.type===type)?.label??type

 useEffect(()=>{reportV2Api.types().then(setTypes).catch(e=>setError(e.message))},[])
 const load=async()=>{setLoading(true);setError('');try{setRows(await reportV2Api.manage(type))}catch(e){setRows([]);setError(e instanceof Error?e.message:'Unable to load templates')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[type])

 const run=async(action:()=>Promise<unknown>,done:string)=>{try{await action();message.success(done);await load()}catch(e){message.error(e instanceof Error?e.message:'Action failed')}}
 const grouped=useMemo(()=>Object.entries(types.reduce<Record<string,ReportTypeInfo[]>>((g,t)=>((g[t.module]??=[]).push(t),g),{})).map(([label,items])=>({label,options:items.map(t=>({value:t.type,label:t.label}))})),[types])

 /** Standard layout built from the latest real record of the type, saved and made the default. */
 const createStandard=async(t:string,label:string)=>{
  const sample=await reportV2Api.sample(t).catch(()=>({}))
  let saved=await reportV2Api.save(undefined,{type:t,name:label+' — standard',layout:JSON.stringify(professionalLayout(t,sample)),listOnPrint:false})
  if(!saved.details.isDefault&&canPublish)saved=await reportV2Api.flags(saved.id,{version:saved.version,isDefault:true})
  return saved
 }
 const createDefault=()=>{
  const go=()=>run(async()=>{setBusy('Creating…');try{const t=await createStandard(type,typeLabel);if(!t.details.isDefault)message.info('Saved. Ask a user with the publish permission to make it the default.')}finally{setBusy('')}},'Default template created for '+typeLabel)
  if(rows.some(r=>r.details.isDefault))Modal.confirm({title:'Create a new default for '+typeLabel+'?',content:'A standard template is created and becomes the default. The current default stays in the list.',okText:'Create',onOk:go})
  else void go()
 }
 const createAllMissing=async()=>{
  setBusy('Checking…')
  try{
   const existing=new Set((await reportV2Api.manage()).map(t=>t.details.type))
   const missing=types.filter(t=>!existing.has(t.type))
   if(!missing.length){message.info('Every document type already has a template.');return}
   for(const [i,t] of missing.entries()){setBusy('Creating '+(i+1)+' of '+missing.length+': '+t.label);await createStandard(t.type,t.label)}
   message.success('Created standard templates for '+missing.length+' document types.');await load()
  }catch(e){message.error(e instanceof Error?e.message:'Could not create templates')}
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
   if(file.size>4_000_000)throw new Error('The file is larger than 4 MB.')
   const json=JSON.parse(await file.text()),layout=json.layout??json
   const problem=layoutProblem(layout);if(problem)throw new Error(problem)
   if(json.type&&json.type!==type&&!window.confirm('This design was exported for '+json.type+'. Import it as a '+typeLabel+' template?'))return
   await run(()=>reportV2Api.save(undefined,{type,name:String(json.name||file.name.replace(/\.json$/i,'')).slice(0,120),layout:JSON.stringify(layout),listOnPrint:false}),'Template imported')
  }catch(e){message.error(e instanceof Error?e.message:'Choose an exported report design.')}
 }

 if(editing)return <ReportDesignerV2 type={type} typeLabel={typeLabel} template={editing.template} onClose={changed=>{setEditing(null);if(changed)void load()}}/>

 const templates=<>
  <Space wrap style={{marginBottom:16,width:'100%',justifyContent:'space-between'}}>
   <Space wrap><span>Document</span><Select aria-label="Document type" showSearch optionFilterProp="label" style={{minWidth:320}} value={type} onChange={setType} options={grouped}/></Space>
   <Space wrap>
    <Tooltip title="Standard layout with your letterhead, saved as the default for this document"><Button icon={<ThunderboltOutlined/>} loading={busy==='Creating…'} disabled={!!busy} onClick={createDefault}>Create default template</Button></Tooltip>
    <Button icon={<UploadOutlined/>} onClick={()=>importer.current?.click()}>Import</Button>
    <Button type="primary" icon={<PlusOutlined/>} onClick={()=>setEditing({})}>New template</Button>
   </Space>
  </Space>
  {busy&&busy!=='Creating…'&&<Alert type="info" showIcon title={busy} style={{marginBottom:16}}/>}
  {error&&<Alert type="error" showIcon title={error} style={{marginBottom:16}}/>}
  {!loading&&!rows.length&&!error&&<Alert type="info" showIcon style={{marginBottom:16}} title={'No templates for '+typeLabel+' yet'}
   description="Printing already uses the standard layout with your letterhead. Create a default template to customise it in the designer."
   action={<Button size="small" type="primary" disabled={!!busy} onClick={createDefault}>Create default template</Button>}/>}
  <Table<TemplateV2> rowKey="id" loading={loading} dataSource={rows} pagination={false} columns={[
   {title:'Name',render:(_,t)=><Space><a onClick={()=>setEditing({template:t})}>{t.details.name}</a>{t.details.isDefault&&<Tag color="green">Default</Tag>}{t.details.listOnPrint&&<Tag>Offered when printing</Tag>}</Space>},
   {title:'Layout',width:110,render:(_,t)=>{try{return ({fixed:'Fixed pages',batch:'Batch',flow:'Flowing'} as Record<string,string>)[JSON.parse(t.details.layout).mode]}catch{return ''}}},
   {title:'Revision',width:90,render:(_,t)=>'v'+t.details.revision},
   {title:'Updated',width:180,render:(_,t)=>new Date(t.details.updatedAt).toLocaleString()},
   {title:'',width:330,render:(_,t)=><Space size={4} wrap>
    <Tooltip title="Edit"><Button size="small" icon={<EditOutlined/>} onClick={()=>setEditing({template:t})}/></Tooltip>
    <Tooltip title={canPublish?'Use as default':'Requires the publish permission'}><Button size="small" icon={<StarOutlined/>} disabled={!canPublish||t.details.isDefault} onClick={()=>void run(()=>reportV2Api.flags(t.id,{version:t.version,isDefault:true}),'Default template changed')}/></Tooltip>
    <Button size="small" disabled={!canPublish} onClick={()=>void run(()=>reportV2Api.flags(t.id,{version:t.version,listOnPrint:!t.details.listOnPrint}),t.details.listOnPrint?'No longer offered when printing':'Offered when printing')}>{t.details.listOnPrint?'Hide at print':'Offer at print'}</Button>
    <Tooltip title="Duplicate"><Button size="small" icon={<CopyOutlined/>} onClick={()=>void run(()=>reportV2Api.duplicate(t.id),'Template duplicated')}/></Tooltip>
    <Tooltip title="Export JSON"><Button size="small" icon={<DownloadOutlined/>} onClick={()=>download(t)}/></Tooltip>
    <Tooltip title="History"><Button size="small" icon={<HistoryOutlined/>} onClick={()=>void reportV2Api.history(t.id).then(items=>setHistory({name:t.details.name,items})).catch(e=>message.error(e.message))}/></Tooltip>
    <Tooltip title="Delete"><Button size="small" danger icon={<DeleteOutlined/>} onClick={()=>Modal.confirm({title:'Delete '+t.details.name+'?',content:t.details.isDefault?'This is the default template. Printing falls back to another offered template or the standard layout.':'The template is removed from the list. Its history is kept.',okText:'Delete',okButtonProps:{danger:true},onOk:()=>run(()=>reportV2Api.remove(t.id),'Template deleted')})}/></Tooltip>
   </Space>}
  ]}/>
  <div style={{marginTop:16}}><Button icon={<AppstoreAddOutlined/>} disabled={!!busy} onClick={()=>Modal.confirm({title:'Create standard templates for every document?',content:'Each document type without a template gets the standard layout with your letterhead as its default. Existing templates are not changed.',okText:'Create',onOk:createAllMissing})}>Create defaults for all documents without a template</Button></div>
 </>

 return <div>
  <div className="page-heading"><div><h1>Report designs</h1><p>Set your letterhead once and every document uses it. Each document type prints with its default template; templates marked “offer when printing” can be chosen instead.</p></div></div>
  <input ref={importer} type="file" accept="application/json,.json" style={{display:'none'}} onChange={e=>void importFile(e.target.files?.[0])}/>
  <Tabs activeKey={tab} onChange={setTab} items={[{key:'templates',label:'Templates',children:templates},{key:'letterhead',label:'Letterhead (logo & address)',children:<LetterheadSettings/>}]}/>
  <Modal title={'History · '+(history?.name??'')} open={!!history} footer={null} onCancel={()=>setHistory(null)}>
   <Timeline items={(history?.items??[]).map(h=>({children:<><b>{h.action}</b> · v{h.template.revision} · {new Date(h.at).toLocaleString()}{h.template.isDefault?' · default':''}</>}))}/>
  </Modal>
 </div>
}
