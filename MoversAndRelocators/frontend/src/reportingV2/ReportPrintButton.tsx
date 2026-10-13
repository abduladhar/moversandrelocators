import {useContext,useEffect,useMemo,useRef,useState} from 'react'
import {Alert,Button,Modal,Select,Space,Spin,message} from 'antd'
import {PrinterOutlined} from '@ant-design/icons'
import {BillingPermissions} from '../billingApi'
import {reportV2Api,type TemplateV2} from './api'
import {renderDocument} from './engine/engine'
import {professionalLayout} from './engine/autoLayout'
import {useT} from '../i18n'

type Query=Record<string,string>|string
const STARTER='__starter'

/**
 * Print / PDF for one document with Report Engine V2. The record is fetched from the server by type + id
 * (or the public packing link), rendered with the type's default template — or another template marked
 * "offer when printing" — and shown in a script-less iframe for print and PDF download.
 * With no saved template the system starter layout is generated from the data.
 */
export function ReportPrintButton({type,title,id,query,publicToken,disabled,label,icon,buttonType,size,onPrinted}:{type:string;title:string;id?:string;query?:Query|(()=>Query|null);publicToken?:string;disabled?:boolean;label?:string;icon?:React.ReactNode;buttonType?:'primary'|'default'|'link'|'text';size?:'small'|'middle'|'large';onPrinted?:()=>void}){
 const {t:tr}=useT()
 const permissions=useContext(BillingPermissions)
 const frame=useRef<HTMLIFrameElement>(null),exportRoot=useRef<HTMLDivElement>(null)
 const [open,setOpen]=useState(false),[loading,setLoading]=useState(false),[busy,setBusy]=useState(''),[preparing,setPreparing]=useState(false),[error,setError]=useState('')
 const [templates,setTemplates]=useState<{id:string;name:string;layout:string;isDefault:boolean}[]>([]),[selected,setSelected]=useState(STARTER),[data,setData]=useState<Record<string,unknown>|null>(null)

 const start=async()=>{
  const q=typeof query==='function'?query():query
  if(q===null){message.warning(tr('designer.print.runFirst'));return}
  setOpen(true);setLoading(true);setError('');setData(null);setTemplates([]);setSelected(STARTER)
  try{
   if(publicToken){
    const r=await reportV2Api.publicPacking(publicToken)
    const list=r.layout?[{id:'public',name:r.name||tr('designer.print.packingList'),layout:r.layout,isDefault:true}]:[]
    setTemplates(list);setSelected(list[0]?.id??STARTER);setData(r.data)
   }else{
    const [list,record]=await Promise.all([reportV2Api.printTemplates(type).catch(()=>[] as TemplateV2[]),reportV2Api.data(type,id,q??undefined)])
    const options=list.map(t=>({id:t.id,name:t.details.name,layout:t.details.layout,isDefault:t.details.isDefault}))
    setTemplates(options);setSelected(options.find(t=>t.isDefault)?.id??options[0]?.id??STARTER);setData(record)
   }
  }catch(e){setError(e instanceof Error?e.message:tr('designer.print.loadFailed'))}
  finally{setLoading(false)}
 }

 const rendered=useMemo(()=>{
  if(!data)return null
  const layout=templates.find(t=>t.id===selected)?.layout
  try{return renderDocument(layout??professionalLayout(type,data),data)}
  catch(e){console.error(e);return renderDocument(professionalLayout(type,data),data)}
 },[data,templates,selected,type])

 useEffect(()=>{
  if(!rendered||!exportRoot.current)return
  rendered.engine.exporter.setRoots(exportRoot.current)
  rendered.engine.exporter.fileName=title.replace(/[\\/:*?"<>|]+/g,'-')
  const s=rendered.engine.state.toast$.subscribe(m=>{if(m.startsWith('PDF failed'))message.error(m);setBusy(/ready|failed/i.test(m)?'':m)})
  return ()=>s.unsubscribe()
 },[rendered,title])

 const print=()=>{const w=frame.current?.contentWindow;if(!w)return;w.focus();w.print();onPrinted?.()}
 const pdf=async()=>{if(!rendered)return;setPreparing(true);setBusy(tr('designer.print.preparingPdf'));try{await rendered.engine.exporter.exportPDF(rendered.sheets);onPrinted?.()}finally{setBusy('');setPreparing(false)}}

 if(!publicToken&&!permissions.includes('reports.print'))return null
 return <><Button icon={icon??<PrinterOutlined/>} type={buttonType} size={size} disabled={disabled} onClick={()=>void start()}>{label??tr('designer.print.button')}</Button>
  <Modal title={tr('designer.print.previewTitle',{title})} open={open} width="95%" style={{top:20}} destroyOnHidden onCancel={()=>{if(!busy)setOpen(false)}} footer={<Space>
   <Button onClick={()=>setOpen(false)} disabled={!!busy}>{tr('common.close')}</Button>
   <Button disabled={!rendered||!!busy} onClick={print}>{tr('common.print')}</Button>
   <Button type="primary" disabled={!rendered||!!busy} loading={preparing} onClick={()=>void pdf()}>{tr('designer.print.downloadPdf')}</Button>
  </Space>}>
   {!publicToken&&<Space wrap style={{marginBottom:12}}><span>{tr('designer.editor.design')}</span><Select aria-label={tr('designer.print.designAria')} style={{minWidth:320}} disabled={loading||!!busy} value={selected} onChange={setSelected}
    options={[...templates.map(t=>({value:t.id,label:t.isDefault?tr('designer.print.defaultOption',{name:t.name}):t.name})),{value:STARTER,label:tr('designer.print.standard')}]}/></Space>}
   {error&&<Alert type="error" showIcon title={error}/>}
   {busy&&<Alert type="info" title={busy} style={{marginBottom:8}}/>}
   {loading?<div style={{textAlign:'center',padding:60}}><Spin/></div>:rendered&&<iframe ref={frame} key={selected} title={tr('designer.print.frameTitle')} sandbox="allow-same-origin allow-modals" srcDoc={rendered.html} style={{width:'100%',height:'72vh',border:'1px solid #dce6df',background:'#eef1f5'}}/>}
   <div ref={exportRoot} style={{position:'fixed',left:-99999,top:0}}/>
  </Modal></>
}
