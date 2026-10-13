/* eslint-disable @typescript-eslint/no-explicit-any */
import {useEffect,useMemo,useRef,useState,type CSSProperties,type PointerEvent as RPointerEvent} from 'react'
import {Button,Checkbox,Dropdown,Input,Modal,Select,Space,Tooltip,message} from 'antd'
import {CloseOutlined,RedoOutlined,UndoOutlined} from '@ant-design/icons'
import {reportV2Api,type TemplateV2} from './api'
import {bindData,createEngine,type Engine} from './engine/engine'
import {letterhead,LETTERHEAD_H,professionalLayout} from './engine/autoLayout'
import {layoutProblem} from './engine/validate'
import {isSummaryBand,type ReportElement,type ToolName} from './engine/models'
import {bandName,DesignerPanel} from './DesignerPanel'
import {t as translate,useT} from '../i18n'
import {ErrorBoundary} from './ErrorBoundary'
import './report-designer.css'

/** Re-render whenever the engine state emits a change. */
export function useEngineTick(engine:Engine){
 const [,setTick]=useState(0)
 useEffect(()=>{const s=engine.state.changes$.subscribe(()=>setTick(t=>t+1));return ()=>s.unsubscribe()},[engine])
}

/** Every mode previews against the same record; batch layouts get it as a one-record list. */
export function setRecord(engine:Engine,record:any){
 engine.state.datasets={fixed:record,flow:record,batch:Array.isArray(record)?record:[record]}
 engine.state.emit()
}

const icon=(d:string)=><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={d}/></svg>
/** tip = key under designer.tools */
const TOOLS:{tool:ToolName;tip:string;svg:React.ReactNode;divider?:boolean}[]=[
 {tool:'select',tip:'select',svg:icon('M4 4l7 16 2-7 7-2z'),divider:true},
 {tool:'text',tip:'text',svg:icon('M4 6h16M12 6v13M9 19h6')},
 {tool:'field',tip:'field',svg:icon('M8 4H6a2 2 0 0 0-2 2v3a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3a2 2 0 0 1-2 2h-2')},
 {tool:'table',tip:'table',svg:icon('M3 4h18v16H3zM3 9h18M3 14h18M9 4v16M15 4v16'),divider:true},
 {tool:'line',tip:'line',svg:icon('M4 18L20 6')},
 {tool:'rect',tip:'rect',svg:icon('M4 5h16v14H4z')},
 {tool:'image',tip:'image',svg:icon('M3 4h18v16H3zM21 16l-5-5L5 20')},
 {tool:'barcode',tip:'barcode',svg:icon('M4 5v14M7 5v14M10 5v9M13 5v14M16 5v9M20 5v14')},
 {tool:'qrcode',tip:'qrcode',svg:icon('M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3M20 14v0M17 20h0M20 17v4')}
]

type DesignerProps={type:string;typeLabel:string;template?:TemplateV2;onClose:(changed:boolean)=>void}
/** The designer behind an error boundary, so a rendering fault shows a message (and a way out) instead of a blank page. */
export function ReportDesignerV2(props:DesignerProps){
 const {t:tr}=useT()
 return <ErrorBoundary title={tr('designer.editor.errorTitle')} onReset={()=>props.onClose(false)} resetLabel={tr('designer.editor.backToTemplates')}><Designer {...props}/></ErrorBoundary>
}

function Designer({type,typeLabel,template,onClose}:DesignerProps){
 const {t:tr}=useT()
 const engine=useMemo(()=>createEngine(),[])
 const {state,exporter}=engine
 useEngineTick(engine)
 const exportRoot=useRef<HTMLDivElement>(null),filePick=useRef<HTMLInputElement>(null),pickMode=useRef<'layout'|'data'>('layout')
 const [current,setCurrent]=useState<TemplateV2|undefined>(template)
 const [name,setName]=useState(template?.details.name??tr('designer.editor.defaultName',{type:typeLabel})),[listOnPrint,setListOnPrint]=useState(template?.details.listOnPrint??false)
 const [saved,setSaved]=useState(''),[saving,setSaving]=useState(false),[changed,setChanged]=useState(false),[loading,setLoading]=useState(true)
 const [toast,setToast]=useState(''),record=useRef<any>({})

 useEffect(()=>{
  exporter.setRoots(exportRoot.current!)
  const t=state.toast$.subscribe(m=>{setToast(m);window.clearTimeout((t as any).timer);(t as any).timer=window.setTimeout(()=>setToast(''),1800)})
  state.setReportContext(type,type)
  let alive=true
  reportV2Api.sample(type).catch(()=>({})).then(sample=>{
   if(!alive)return
   record.current=sample
   // A saved layout can be unparseable, and a generated one can fail on an unexpected record. For a
   // new template the record is the only suspect, so the fallback drops it: repeating the identical
   // call would throw again and the rejection would leave the designer loading for ever.
   try{state.importLayout(template?JSON.parse(template.details.layout):professionalLayout(type,sample))}
   catch(e){state.importLayout(professionalLayout(type,{}));message.warning(tr('designer.editor.emptyLayoutWarning',{type:typeLabel,reason:e instanceof Error?e.message:tr('designer.editor.sampleNotLaidOut')}))}
   setRecord(engine,sample);setSaved(JSON.stringify(state.exportLayout()))
  }).catch(e=>{if(alive)message.error(e instanceof Error?e.message:tr('designer.editor.openFailed'))})
   .finally(()=>{if(alive)setLoading(false)})
  return ()=>{alive=false;t.unsubscribe()}
 },[])

 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   const typing=/INPUT|TEXTAREA|SELECT/.test((document.activeElement?.tagName)||'')||(document.activeElement as HTMLElement|null)?.isContentEditable
   if((e.key==='Delete'||e.key==='Backspace')&&state.selId&&!typing){e.preventDefault();state.deleteSel();return}
   if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!e.shiftKey&&!typing){e.preventDefault();state.undo();return}
   if((e.ctrlKey||e.metaKey)&&(e.key.toLowerCase()==='y'||(e.shiftKey&&e.key.toLowerCase()==='z'))&&!typing){e.preventDefault();state.redo();return}
   if(!typing&&state.selId&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
    e.preventDefault();const el=state.sel();if(!el)return
    const d=e.shiftKey?10:1
    if(e.key==='ArrowUp')el.y-=d;if(e.key==='ArrowDown')el.y+=d;if(e.key==='ArrowLeft')el.x-=d;if(e.key==='ArrowRight')el.x+=d
    el.x=Math.max(0,el.x);el.y=Math.max(0,el.y);state.emit()
   }
  }
  document.addEventListener('keydown',onKey);return ()=>document.removeEventListener('keydown',onKey)
 },[state])

 const dirty=!loading&&JSON.stringify(state.exportLayout())!==saved
 const close=()=>{
  if(!dirty){onClose(changed);return}
  Modal.confirm({title:tr('designer.editor.discardTitle'),content:tr('designer.editor.discardContent'),okText:tr('designer.editor.discard'),okButtonProps:{danger:true},onOk:()=>onClose(changed),zIndex:1100})
 }
 const save=async()=>{
  const layout=state.exportLayout(),problem=layoutProblem(JSON.parse(JSON.stringify(layout)))
  if(!name.trim()){message.error(tr('designer.editor.enterName'));return}
  if(problem){message.error(problem);return}
  setSaving(true)
  try{
   const json=JSON.stringify(layout)
   const t=await reportV2Api.save(current?.id,{version:current?.version,type,name:name.trim(),layout:json,listOnPrint})
   setCurrent(t);setSaved(json);setChanged(true);message.success(current?tr('designer.editor.updated'):t.details.isDefault?tr('designer.editor.savedAsDefault',{type:typeLabel}):tr('designer.editor.saved'))
  }catch(e){message.error(e instanceof Error?e.message:tr('designer.editor.saveFailed'))}
  finally{setSaving(false)}
 }
 const onFile=async()=>{
  const f=filePick.current?.files?.[0];if(filePick.current)filePick.current.value='';if(!f)return
  try{
   const j=JSON.parse(await f.text())
   if(pickMode.current==='layout'){const problem=layoutProblem(j);if(problem){message.error(problem);return}state.importLayout(j)}
   else{record.current=j;setRecord(engine,j);state.toast(tr('designer.editor.dataLoaded'))}
  }catch{message.error(tr('designer.editor.invalidJson'))}
 }
 const sampleGroups=useMemo(()=>{const g:Record<string,typeof state.samples>={};state.samples.forEach(s=>(g[s.group]??=[]).push(s));return Object.entries(g)},[state])
 const mode=state.doc.mode,view=state.viewMode

 return <div className="report-engine-v2">
  <div className="rev2-topbar">
   <div className="rev2-brand"><span className="rev2-dot"/> {tr('designer.editor.brand')}</div>
   <select className="rev2-reptype" title={tr('designer.editor.executionModel')} value={mode} onChange={e=>state.setReportType(e.target.value as any)}>
    <option value="fixed">{tr('designer.editor.modeFixed')}</option><option value="batch">{tr('designer.editor.modeBatch')}</option><option value="flow">{tr('designer.editor.modeFlow')}</option>
   </select>
   <div className="rev2-tsep"/>
   <button className="rev2-tbtn" onClick={()=>Modal.confirm({title:tr('designer.editor.professionalTitle'),content:tr('designer.editor.professionalContent',{type:typeLabel}),okText:tr('designer.editor.replace'),zIndex:1100,onOk:()=>{state.importLayout(professionalLayout(type,record.current));state.toast(tr('designer.editor.professionalApplied'))}})} title={tr('designer.editor.professionalTip')}>{icon('M4 4h16v6H4zM4 14h7v6H4zM15 14h5v6h-5z')}{tr('designer.editor.professional')}</button>
   <button className="rev2-tbtn" onClick={()=>insertLetterhead(engine)} title={tr('designer.editor.letterheadTip')}>{icon('M3 5h7v6H3zM14 6h7M14 9h7M14 12h5M3 15h18')}{tr('designer.editor.letterhead')}</button>
   <button className="rev2-tbtn" onClick={()=>state.emptyTemplate()}>{icon('M14 3v4a1 1 0 0 0 1 1h4M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z')}{tr('designer.editor.empty')}</button>
   <Dropdown trigger={['click']} menu={{style:{maxHeight:'70vh',overflow:'auto'},items:sampleGroups.map(([group,items])=>({type:'group' as const,key:group,label:group,children:items.map(s=>({key:s.key,label:<div><b>{s.name}</b><div style={{fontSize:11,color:'#6b7686'}}>{s.desc}</div></div>}))})),onClick:({key})=>{state.loadSample(key);setRecord(engine,record.current)}}}>
    <button className="rev2-tbtn">{icon('M9 14l2 2 4-4M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z')}{tr('designer.editor.samples')}</button>
   </Dropdown>
   <div className="rev2-tsep"/>
   <button className="rev2-tbtn" onClick={()=>{pickMode.current='layout';filePick.current?.click()}}>{icon('M12 3v12m0 0l-4-4m4 4l4-4M5 21h14')}{tr('designer.editor.openLayout')}</button>
   <button className="rev2-tbtn" onClick={()=>exporter.downloadLayout()}>{icon('M12 21V9m0 0l-4 4m4-4l4 4M5 3h14')}{tr('designer.editor.saveLayout')}</button>
   <button className="rev2-tbtn" onClick={()=>{pickMode.current='data';filePick.current?.click()}}>{icon('M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3v14c0 1.7-3.6 3-8 3s-8-1.3-8-3zM4 5c0 1.7 3.6 3 8 3s8-1.3 8-3')}{tr('designer.editor.loadData')}</button>
   <button className="rev2-tbtn" title={tr('designer.editor.liveDataTip')} onClick={()=>void reportV2Api.sample(type).then(s=>{record.current=s;setRecord(engine,s);state.toast(tr('designer.editor.latestLoaded'))}).catch(e=>message.error(e.message))}>{icon('M4 4v6h6M20 20v-6h-6M5 15a7 7 0 0 0 12 3M19 9A7 7 0 0 0 7 6')}{tr('designer.editor.liveData')}</button>
   <div className="rev2-spacer"/>
   <Tooltip title={tr('designer.editor.undo')}><button className="rev2-tbtn" aria-label={tr('designer.editor.undo')} onClick={()=>state.undo()}><UndoOutlined/></button></Tooltip>
   <Tooltip title={tr('designer.editor.redo')}><button className="rev2-tbtn" aria-label={tr('designer.editor.redo')} onClick={()=>state.redo()}><RedoOutlined/></button></Tooltip>
   <div className="rev2-seg">
    <button className={'rev2-tbtn'+(view==='design'?' rev2-on':'')} onClick={()=>state.setViewMode('design')}>{icon('M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z')}{tr('designer.editor.design')}</button>
    <button className={'rev2-tbtn'+(view==='preview'?' rev2-on':'')} onClick={()=>state.setViewMode('preview')}>{icon('M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z')}{tr('designer.editor.preview')}</button>
   </div>
   <select className="rev2-mini" title={tr('designer.editor.zoom')} value={state.zoom} onChange={e=>{state.zoom=+e.target.value;state.emit()}}>{[0.5,0.65,0.75,0.9,1,1.1,1.25].map(z=><option key={z} value={z}>{Math.round(z*100)}%</option>)}</select>
   <button className={'rev2-tbtn'+(state.grid?' rev2-on':'')} title={tr('designer.editor.grid')} aria-label={tr('designer.editor.grid')} onClick={()=>{state.grid=!state.grid;state.emit()}}>{icon('M3 9h18M3 15h18M9 3v18M15 3v18')}</button>
   <div className="rev2-tsep"/>
   <button className="rev2-tbtn rev2-ghost" onClick={()=>exporter.downloadHTML()}>{icon('M8 9l-3 3 3 3M16 9l3 3-3 3M13 6l-2 12')}HTML</button>
   <button className="rev2-tbtn rev2-ghost" onClick={()=>exporter.print()}>{icon('M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6z')}{tr('common.print')}</button>
   <button className="rev2-tbtn rev2-primary" onClick={()=>void exporter.exportPdfDispatch()}>{icon('M14 3v4a1 1 0 0 0 1 1h4M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-5z')}PDF</button>
   <input ref={filePick} type="file" accept="application/json,.json" style={{display:'none'}} onChange={()=>void onFile()}/>
  </div>
  <div className="rev2-topbar rev2-ctxbar">
   <span className="rev2-ctx"><span className="rev2-ctx-label">{tr('designer.editor.reportType')}</span><span className="rev2-ctx-val">{typeLabel}</span></span>
   <span className="rev2-ctx"><span className="rev2-ctx-label">{tr('designer.editor.templateName')}</span><Input size="small" style={{width:260}} value={name} maxLength={120} onChange={e=>setName(e.target.value)} aria-label={tr('designer.editor.templateNameAria')}/></span>
   <Checkbox checked={listOnPrint} onChange={e=>setListOnPrint(e.target.checked)}>{tr('designer.editor.offerWhenPrinting')}</Checkbox>
   {current?.details.isDefault&&<span className="rev2-ctx-val">{tr('designer.templates.defaultTag')}</span>}
   <Space style={{marginInlineStart:'auto'}}>
    {dirty&&<span style={{color:'#b48a3a',fontSize:12}}>{tr('designer.editor.unsaved')}</span>}
    <Button type="primary" size="small" loading={saving} onClick={()=>void save()}>{current?tr('common.update'):tr('common.save')}</Button>
    <Button size="small" icon={<CloseOutlined/>} onClick={close}>{tr('common.close')}</Button>
   </Space>
  </div>
  <div className="rev2-stage">
   <div className="rev2-palette">
    {TOOLS.map(t=><div key={t.tool} style={{display:'contents'}}>
     <button className={'rev2-ptool'+(state.tool===t.tool?' rev2-on':'')+(t.tool==='table'&&mode==='flow'?' rev2-hide':'')} onClick={()=>{state.setTool(t.tool);state.emit()}} aria-label={tr('designer.tools.'+t.tip)}><span className="rev2-tip">{tr('designer.tools.'+t.tip)}</span>{t.svg}</button>
     {t.divider&&<div className="rev2-pdiv"/>}
    </div>)}
   </div>
   {loading?<div className="rev2-workspace" style={{display:'flex',alignItems:'center',justifyContent:'center'}}>{tr('designer.editor.loadingData')}</div>:<Workspace engine={engine}/>}
   {loading?<div className="rev2-rpanel"/>:<DesignerPanel engine={engine} type={type}/>}
  </div>
  <div ref={exportRoot} style={{position:'fixed',left:-99999,top:0,background:'#fff'}}/>
  <div className={'rev2-toast'+(toast?' rev2-show':'')}>{toast}</div>
 </div>
}

/** Letterhead (logo left, address right) at the top of the current page, or in the page header band of a flowing report. */
function insertLetterhead(engine:Engine){
 const {state}=engine,page:any=state.doc.page
 const inner=page.w-2*page.margin
 if(state.doc.mode==='flow'){
  const band=state.doc.bands.pageHeader
  band.on=true;band.h=Math.max(band.h||0,LETTERHEAD_H+6)
  band.elements=[...letterhead(inner),...(band.elements||[]).map((e:ReportElement)=>({...e,y:e.y+LETTERHEAD_H+6}))]
  band.h=Math.max(band.h,...band.elements.map((e:ReportElement)=>e.y+e.h))
 }else{
  for(const e of state.elements)e.y+=LETTERHEAD_H+6
  state.elements.unshift(...letterhead(inner,page.margin,page.margin))
 }
 state.pushHistory();state.emit();state.toast(translate('designer.editor.letterheadAdded'))
}

/* ---------------- canvas ---------------- */

function Workspace({engine}:{engine:Engine}){
 const {t:tr}=useT()
 const {state,render,exporter}=engine
 const sheet=useRef<HTMLDivElement>(null)
 const page:any=state.doc.page,mode=state.doc.mode,zoom=state.zoom
 const snap=(v:number)=>state.grid?Math.round(v/10)*10:Math.round(v)
 const point=(ev:{clientX:number;clientY:number})=>{const r=sheet.current?.getBoundingClientRect();return r?{x:(ev.clientX-r.left)/zoom,y:(ev.clientY-r.top)/zoom}:{x:0,y:0}}
 const record=state.previewRecord()
 const wm=render.watermarkHTML(state.doc.watermark)

 const drag=(onMove:(m:PointerEvent)=>void)=>{
  const up=()=>{document.removeEventListener('pointermove',onMove);document.removeEventListener('pointerup',up);state.pushHistory();state.emit()}
  document.addEventListener('pointermove',onMove);document.addEventListener('pointerup',up)
 }
 const startMove=(ev:RPointerEvent,el:ReportElement,ox:number,oy:number)=>{
  state.selId=el.id;state.selBand=null;state.activeTab='props';state.emit()
  const p=point(ev),gx=p.x-(ox+el.x),gy=p.y-(oy+el.y)
  drag(m=>{
   const q=point(m),nx=Math.max(0,q.x-gx),ny=Math.max(0,q.y-gy)
   if(mode==='flow'&&el.band){
    const stack=state.bandStack().bands.filter((s:any)=>s.free)
    const band=stack.find((s:any)=>ny>=s.top&&ny<s.top+s.h)??stack.reduce((b:any,s:any)=>Math.abs(s.top+s.h/2-ny)<Math.abs(b.top+b.h/2-ny)?s:b,stack[0])
    if(band&&band.id!==el.band){
     const from=state.doc.bands[el.band].elements as ReportElement[],to=state.doc.bands[band.id].elements as ReportElement[]
     from.splice(from.indexOf(el),1);to.push(el);el.band=band.id
    }
    if(band){el.x=snap(nx-page.margin);el.y=snap(Math.min(Math.max(0,ny-band.top),band.h-6))}
   }else{el.x=snap(nx);el.y=snap(ny)}
   state.emit()
  })
 }
 const startResize=(ev:RPointerEvent,el:ReportElement)=>{
  const p=point(ev),ow=el.w,oh=el.h
  drag(m=>{
   const q=point(m)
   if(el.type==='line'&&(el.lineDir||'h')==='h')el.w=snap(Math.max(8,ow+q.x-p.x))
   else if(el.type==='line')el.h=snap(Math.max(8,oh+q.y-p.y))
   else{el.w=snap(Math.max(16,ow+q.x-p.x));el.h=snap(Math.max(12,oh+q.y-p.y))}
   state.emit()
  })
 }
 const place=(ev:RPointerEvent)=>{
  if(state.viewMode!=='design')return
  if(state.tool==='select'){state.selId=null;state.selBand=null;state.emit();return}
  if(mode==='flow')return
  const p=point(ev),e=state.makeEl(state.tool,snap(p.x),snap(p.y))
  state.elements.push(e);state.selId=e.id;state.setTool('select');state.activeTab='props';state.pushHistory();state.emit()
 }
 const bandDown=(s:any,ev:RPointerEvent)=>{
  if((ev.target as HTMLElement).closest('.rev2-de'))return
  ev.stopPropagation()
  if(state.tool!=='select'&&s.free){
   const p=point(ev),e=state.makeEl(state.tool,Math.max(0,snap(p.x-page.margin)),Math.max(0,snap(p.y-s.top)))
   e.band=s.id;(state.doc.bands[s.id].elements as ReportElement[]).push(e)
   state.selId=e.id;state.selBand=null;state.setTool('select');state.pushHistory();state.emit();return
  }
  state.selBand=s.id;state.selId=null;state.activeTab='props';state.emit()
 }

 if(state.viewMode==='preview'){
  let sheets:{html:string;w:number;h:number}[]=[]
  try{sheets=exporter.exportSheets()}catch(e){console.error(e)}
  return <div className="rev2-workspace"><div className="rev2-canvas-wrap">
   {sheets.map((s,i)=><div key={i} className="rev2-sheet-wrap">
    <div className="rev2-pagebadge">{tr('designer.editor.pageOf',{page:i+1,pages:sheets.length})}</div>
    <div className="rev2-psheet-preview" style={{width:s.w,height:s.h,transform:'scale('+zoom+')',marginBottom:(zoom-1)*s.h}} dangerouslySetInnerHTML={{__html:s.html}}/>
   </div>)}
  </div></div>
 }

 if(mode==='flow'){
  const stack=state.bandStack()
  const height=Math.max(stack.total+page.margin,260)
  const detail=state.doc.bands.detail
  const bandTable=(id:string)=>{
   const opts:any={fontFamily:detail.fontFamily,fontSize:detail.fontSize,color:detail.color,headerBg:state.doc.bands.columnHeader.headerBg||detail.headerBg,headerColor:state.doc.bands.columnHeader.headerColor||detail.headerColor,gridColor:detail.gridColor,zebra:detail.zebra,showHeader:id==='columnHeader',designRows:id==='detail'?3:0}
   let html=render.buildTable(detail.columns||[],opts,null,false)
   if(id==='columnHeader')html=html.replace(/<tbody>[\s\S]*<\/tbody>/,'<tbody></tbody>')
   return html
  }
  return <div className="rev2-workspace"><div className="rev2-canvas-wrap"><div className="rev2-sheet-wrap">
   <div className="rev2-pagebadge">{tr('designer.editor.flowBadge')}</div>
   <div ref={sheet} data-editsheet="1" className={'rev2-sheet'+(state.grid?' rev2-grid':'')} style={{width:page.w,height,transform:'scale('+zoom+')',marginBottom:(zoom-1)*height}} onPointerDown={place}>
    {stack.bands.map((s:any)=><div key={s.id}>
     <div className={'rev2-band'+(s.free?' rev2-free':'')+(state.selBand===s.id?' rev2-selband':'')} style={{top:s.top,height:s.h}} onPointerDown={e=>bandDown(s,e)}>
      <div className={'rev2-bandtag'+(state.doc.bands[s.id].optional?' rev2-opt':'')}>{bandName(tr,s.id)}{isSummaryBand(s.id)?' — '+tr('designer.editor.flowsAfterDetail'):state.doc.bands[s.id].optional?' ('+tr('common.optional').toLowerCase()+')':''}</div>
     </div>
     {(s.id==='columnHeader'||s.id==='detail')&&<div style={{position:'absolute',pointerEvents:'none',left:page.margin,top:s.top,width:page.w-2*page.margin}} dangerouslySetInnerHTML={{__html:bandTable(s.id)}}/>}
    </div>)}
    {stack.bands.filter((s:any)=>s.free).flatMap((s:any)=>(state.doc.bands[s.id].elements||[]).map((el:ReportElement)=>
     <DesignElement key={el.id} engine={engine} el={el} record={record} ox={page.margin} oy={s.top} onMove={startMove} onResize={startResize}/>))}
    {wm&&<div dangerouslySetInnerHTML={{__html:wm}}/>}
   </div>
  </div></div></div>
 }

 const P=state.P()
 return <div className="rev2-workspace"><div className="rev2-canvas-wrap">
  <div className="rev2-pagenav">
   {state.doc.pages.map((pg,i)=><div key={pg.id} className={'rev2-pchip'+(i===state.doc.activePage?' rev2-on':'')}>
    <button className="rev2-pchip-lab" onClick={()=>state.setActivePage(i)}>{tr('designer.editor.page',{page:i+1})} <span className="rev2-psz">{pg.size}</span></button>
    <button className="rev2-pchip-mini" title={tr('designer.editor.duplicatePage')} aria-label={tr('designer.editor.duplicatePage')} onClick={()=>state.dupPage(i)}>⧉</button>
    <button className="rev2-pchip-mini rev2-del" title={tr('designer.editor.deletePage')} aria-label={tr('designer.editor.deletePage')} onClick={()=>state.deletePage(i)}>✕</button>
   </div>)}
   <button className="rev2-paddbtn" onClick={()=>state.addPage()}>＋ {tr('designer.editor.addPage')}</button>
  </div>
  <div className="rev2-sheet-wrap">
   <div className="rev2-pagebadge">{[mode==='batch'?tr('designer.editor.batchBadge'):'',state.doc.repeatPath?tr('designer.editor.repeatsBadge',{path:state.doc.repeatPath}):'',tr('designer.editor.pageOf',{page:state.doc.activePage+1,pages:state.doc.pages.length})].filter(Boolean).join(' — ')}</div>
   <div ref={sheet} data-editsheet="1" className={'rev2-sheet'+(state.grid?' rev2-grid':'')} style={{width:P.w,height:P.h,transform:'scale('+zoom+')',marginBottom:(zoom-1)*P.h}} onPointerDown={place}>
    <div className="rev2-marg" style={{left:P.margin,top:P.margin,width:P.w-2*P.margin,height:P.h-2*P.margin}}/>
    {P.elements.map(el=><DesignElement key={el.id} engine={engine} el={el} record={record} ox={0} oy={0} onMove={startMove} onResize={startResize}/>)}
    {wm&&<div dangerouslySetInnerHTML={{__html:wm}}/>}
   </div>
  </div>
 </div></div>
}

function DesignElement({engine,el,record,ox,oy,onMove,onResize}:{engine:Engine;el:ReportElement;record:any;ox:number;oy:number;onMove:(ev:RPointerEvent,el:ReportElement,ox:number,oy:number)=>void;onResize:(ev:RPointerEvent,el:ReportElement)=>void}){
 const {state,render,expr}=engine
 const {t:tr}=useT()
 const selected=state.selId===el.id
 const autoH=!!el.autoHeight&&['table','text','field'].includes(el.type)
 const box:CSSProperties={...render.boxCss(el),left:ox+el.x,top:oy+el.y,overflow:el.type==='table'?'visible':'hidden',...(autoH?{height:'auto'}:{}),...(el.type==='line'?{border:'none',background:'transparent'}:{})}
 let html=''
 if(el.type!=='line'&&el.type!=='rect'){
  expr.bind=record||{}
  try{html=render.elInnerHtml(el,false)}catch(err){html='<div style="color:#c0392b;font:11px monospace">'+expr.escapeHtml(tr('designer.editor.renderError',{message:String((err as Error)?.message??err)}))+'</div>'}
 }
 const line:CSSProperties=(el.lineDir||'h')==='h'?{position:'absolute',top:'50%',transform:'translateY(-50%)',width:'100%',height:Math.max(1,el.h),background:el.bg}:{position:'absolute',left:'50%',transform:'translateX(-50%)',height:'100%',width:Math.max(1,el.w),background:el.bg}
 return <div className={'rev2-de'+(selected?' rev2-sel':'')} style={box} onPointerDown={ev=>{if(state.viewMode!=='design'||(ev.target as HTMLElement).classList.contains('rev2-rh'))return;ev.stopPropagation();onMove(ev,el,ox,oy)}}>
  {el.type==='line'?<div style={line}/>:el.type==='rect'?null:el.type==='barcode'||el.type==='qrcode'
   ?<div style={{width:'100%',height:'100%'}} dangerouslySetInnerHTML={{__html:html}}/>
   :<div className="rev2-de-content" style={{...render.fontCss(el),...(autoH?{height:'auto',overflow:'visible',display:'block'}:{})}} dangerouslySetInnerHTML={{__html:html}}/>}
  {selected&&<div className="rev2-rh" onPointerDown={ev=>{ev.stopPropagation();onResize(ev,el)}}/>}
 </div>
}
