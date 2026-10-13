/* eslint-disable @typescript-eslint/no-explicit-any */
import {useMemo,useRef,useState} from 'react'
import {AutoComplete,Button,Checkbox,Input,InputNumber,Radio,Select,Slider,Space,Switch,Tabs,Tooltip,Upload,message} from 'antd'
import {ArrowDownOutlined,ArrowUpOutlined,BoldOutlined,ColumnWidthOutlined,CopyOutlined,DeleteOutlined,ItalicOutlined,PlusOutlined,UnderlineOutlined,VerticalAlignMiddleOutlined,VerticalAlignTopOutlined} from '@ant-design/icons'
import type {Engine} from './engine/engine'
import {nid} from './engine/factory'
import {bandLabelFor,bandOrder,FONT_FAMILIES,isFreeBand,isSummaryBand,MAX_SUMMARY_BANDS,PAGE_GROUPS,PAGE_SIZES,type ColumnDef,type FixedCell,type ReportElement} from './engine/models'
import {watermarkNamesFor} from './engine/watermarks'
import {useT} from '../i18n'

type Tr=ReturnType<typeof useT>['t']
const BAND_KEYS=['pageHeader','reportHeader','columnHeader','detail','reportFooter','pageFooter']
/** Band name in the user's language (the engine's bandLabelFor stays English). */
export function bandName(tr:Tr,id:string){
 if(BAND_KEYS.includes(id))return tr('designer.bands.'+id)
 if(isSummaryBand(id))return tr('designer.bands.summary',{n:id.substring('summary'.length)})
 return bandLabelFor(id)
}
const PAGE_GROUP_KEYS:Record<string,string>={'Documents':'documents','Cargo / shipping labels':'cargo','Thermal / GS1 labels':'thermal'}
/** Element types stored in templates → designer.elementTypes.* */
const TYPE_KEYS=['text','field','line','rect','image','barcode','qrcode','table']
const aligns=(tr:Tr)=>[{value:'left',label:tr('designer.panel.left')},{value:'center',label:tr('designer.panel.center')},{value:'right',label:tr('designer.panel.right')}]

const IMAGE_TYPES=['image/png','image/jpeg','image/gif','image/webp']

/* ---------- schema helpers (variable tree = the loaded data record) ---------- */
function arrayPaths(tree:any):string[]{
 const out:string[]=[]
 const walk=(node:any,prefix:string,depth:number)=>{
  if(!node||typeof node!=='object'||depth>5)return
  for(const key of Object.keys(node)){
   const val=node[key],path=prefix?prefix+'.'+key:key
   if(Array.isArray(val)){out.push(path);if(val[0]&&typeof val[0]==='object')walk(val[0],path,depth+1)}
   else if(val&&typeof val==='object')walk(val,path,depth+1)
  }
 }
 walk(tree,'',0);return out
}
function leafPaths(item:any):string[]{
 const out:string[]=[]
 const walk=(obj:any,prefix:string,depth:number)=>{
  if(!obj||typeof obj!=='object'||Array.isArray(obj)||depth>5)return
  for(const key of Object.keys(obj)){
   const val=obj[key],path=prefix?prefix+'.'+key:key
   if(val&&typeof val==='object'&&!Array.isArray(val))walk(val,path,depth+1)
   else if(!Array.isArray(val))out.push(path)
  }
 }
 walk(item,'',0);return out
}
function rowFields(tree:any,dataPath:string):string[]{
 if(!dataPath)return []
 let node=tree
 for(const seg of dataPath.split('.')){if(node==null)return [];node=Array.isArray(node)?(node[0]||{})[seg]:node[seg]}
 return leafPaths(Array.isArray(node)?(node[0]||{}):node)
}

/** Colour input with an optional "none" (transparent) toggle for fills. */
function Color({value,onChange,allowNone=false}:{value?:string;onChange:(v:string)=>void;allowNone?:boolean}){
 const {t:tr}=useT()
 const none=!value||value==='transparent'
 return <Space size={4}>
  <input type="color" aria-label={tr('designer.panel.colour')} value={none?'#ffffff':(value!.length===4?'#'+value![1]+value![1]+value![2]+value![2]+value![3]+value![3]:value!.slice(0,7))} onChange={e=>onChange(e.target.value)} style={{width:34,height:24,padding:0,border:'1px solid #dde3ec',borderRadius:4,background:'none'}}/>
  {allowNone&&<Checkbox checked={none} onChange={e=>onChange(e.target.checked?'transparent':'#ffffff')}>{tr('common.none')}</Checkbox>}
 </Space>
}

/** Select that inserts a {{field}} token. */
function FieldPicker({fields,onPick,placeholder}:{fields:string[];onPick:(f:string)=>void;placeholder?:string}){
 const {t:tr}=useT()
 return <Select size="small" showSearch placeholder={placeholder??tr('designer.panel.insertField')} value={null} style={{width:'100%'}} options={fields.map(f=>({value:f,label:f}))} onChange={v=>v&&onPick(v)} popupMatchSelectWidth={false}/>
}

export function DesignerPanel({engine,type}:{engine:Engine;type:string}){
 const {t:tr}=useT()
 const {state}=engine
 const commit=()=>{state.pushHistory();state.emit()}
 const live=()=>state.emit()
 const tree=state.previewRecord()
 const arrays=useMemo(()=>arrayPaths(tree),[tree])
 const recordFields=useMemo(()=>{
  const base=leafPaths(tree),rp=(state.doc.repeatPath||'').trim()
  return rp?Array.from(new Set([...rowFields(tree,rp),...base])):base
 },[tree,state.doc.repeatPath])
 const e=state.sel()

 const props=e?<ElementProps engine={engine} e={e} commit={commit} live={live} arrays={arrays} tree={tree} recordFields={recordFields}/>
  :state.selBand&&state.doc.mode==='flow'?<BandProps engine={engine} id={state.selBand} commit={commit} live={live} arrays={arrays} tree={tree}/>
  :<DocumentProps engine={engine} type={type} commit={commit} live={live} arrays={arrays}/>

 return <div className="rev2-rpanel">
  <Tabs activeKey={state.activeTab} onChange={k=>state.setActiveTab(k as any)} style={{height:'100%'}} tabBarStyle={{padding:'0 14px',marginBottom:0}} items={[
   {key:'props',label:tr('designer.panel.properties'),children:props},
   {key:'data',label:tr('designer.panel.variables'),children:<VariableTree engine={engine} data={tree}/>}
  ]}/>
 </div>
}

/* ---------- nothing selected: page, watermark, bands ---------- */
function DocumentProps({engine,type,commit,live,arrays}:{engine:Engine;type:string;commit:()=>void;live:()=>void;arrays:string[]}){
 const {state}=engine,page:any=state.doc.page,wm=state.watermark(),flow=state.doc.mode==='flow'
 const names=watermarkNamesFor(type)
 const {t:tr}=useT()
 return <>
  <div className="rev2-sec"><h4>{tr('designer.panel.pageMode',{mode:['fixed','batch','flow'].includes(state.doc.mode)?tr('designer.modes.'+state.doc.mode):state.doc.mode})}</h4>
   <div className="rev2-grid2">
    <label className="rev2-f">{tr('designer.panel.size')}<Select size="small" value={page.size} onChange={v=>{page.size=v;const d=PAGE_SIZES[v];page.w=d[0];page.h=d[1];commit()}} options={PAGE_GROUPS.map(g=>({label:PAGE_GROUP_KEYS[g.label]?tr('designer.pageGroups.'+PAGE_GROUP_KEYS[g.label]):g.label,options:g.items.map(([value,label])=>({value,label}))}))} popupMatchSelectWidth={false}/></label>
    <label className="rev2-f">{tr('designer.panel.marginPx')}<InputNumber size="small" min={0} max={200} value={page.margin} onChange={v=>{page.margin=v??0;commit()}}/></label>
   </div>
   {!flow&&<label className="rev2-f" style={{marginTop:8}}>{tr('designer.panel.repeatFor')}
    <Select size="small" allowClear placeholder={tr('designer.panel.repeatOff')} value={state.doc.repeatPath||undefined} onChange={v=>{state.doc.repeatPath=v||'';commit()}} options={arrays.map(a=>({value:a,label:a}))}/>
   </label>}
   {!flow&&<p className="rev2-hint" style={{marginTop:6}}>{tr('designer.panel.repeatHint',{example:'{{trackingNumber}}'})}</p>}
  </div>
  <div className="rev2-sec"><h4>{tr('designer.panel.watermark')}</h4>
   <Space orientation="vertical" style={{width:'100%'}} size={6}>
    <Switch size="small" checked={wm.on} onChange={v=>{wm.on=v;commit()}} checkedChildren={tr('designer.panel.on')} unCheckedChildren={tr('designer.panel.off')} aria-label={tr('designer.panel.watermark')}/>
    <AutoComplete size="small" style={{width:'100%'}} value={wm.text} options={names.map(n=>({value:n}))} onChange={v=>{wm.text=v;live()}} onBlur={()=>state.pushHistory()} placeholder={tr('designer.panel.watermarkPlaceholder')}/>
    <div className="rev2-grid2">
     <label className="rev2-f">{tr('designer.panel.colour')}<Color value={wm.color} onChange={v=>{wm.color=v;live()}}/></label>
     <label className="rev2-f">{tr('designer.panel.size')}<InputNumber size="small" min={8} max={400} value={wm.fontSize} onChange={v=>{wm.fontSize=v||110;commit()}}/></label>
     <label className="rev2-f">{tr('designer.panel.angle')}<InputNumber size="small" min={-90} max={90} value={wm.angle} onChange={v=>{wm.angle=v??0;commit()}}/></label>
     <label className="rev2-f">{tr('designer.panel.opacity')}<Slider min={0} max={1} step={0.05} value={wm.opacity} onChange={v=>{wm.opacity=v;live()}} onChangeComplete={()=>state.pushHistory()}/></label>
    </div>
    <Checkbox checked={wm.bold} onChange={e=>{wm.bold=e.target.checked;commit()}}>{tr('designer.panel.bold')}</Checkbox>
   </Space>
  </div>
  {flow&&<div className="rev2-sec"><h4>{tr('designer.panel.reportBands')}</h4>
   {bandOrder(state.doc).map(id=>{const b=state.doc.bands[id];if(!b)return null;const summary=isSummaryBand(id),order=state.doc.summaryOrder||[]
    return <div key={id} className={'rev2-bandrow'+(state.selBand===id?' rev2-on':'')} onClick={()=>{state.selBand=id;state.selId=null;state.emit()}}>
     {b.optional&&<Switch size="small" checked={b.on!==false} onClick={(v,ev)=>{ev.stopPropagation();b.on=v;commit()}}/>}
     <span>{bandName(tr,id)}</span>
     {summary&&<span onClick={ev=>ev.stopPropagation()}>
      <Button size="small" type="text" icon={<ArrowUpOutlined/>} aria-label={tr('designer.panel.moveUp')} disabled={order.indexOf(id)===0} onClick={()=>state.moveSummaryBand(id,-1)}/>
      <Button size="small" type="text" icon={<ArrowDownOutlined/>} aria-label={tr('designer.panel.moveDown')} disabled={order.indexOf(id)===order.length-1} onClick={()=>state.moveSummaryBand(id,1)}/>
      <Button size="small" type="text" danger icon={<DeleteOutlined/>} aria-label={tr('designer.panel.removeSection')} onClick={()=>state.removeSummaryBand(id)}/>
     </span>}
     <span className="rev2-pill">{id==='detail'?tr('designer.panel.rowPill',{height:b.rowH}):id==='columnHeader'?tr('designer.panel.auto'):b.h+'px'}</span>
    </div>})}
   <Button size="small" icon={<PlusOutlined/>} style={{marginTop:6}} disabled={(state.doc.summaryOrder||[]).length>=MAX_SUMMARY_BANDS} onClick={()=>state.addSummaryBand()}>{tr('designer.panel.summarySection')}</Button>
   <p className="rev2-hint" style={{marginTop:6}}>{tr('designer.panel.bandsHint',{page:'{{PAGE}}',pages:'{{PAGES}}'})}</p>
  </div>}
 </>
}

/* ---------- flow band selected ---------- */
function BandProps({engine,id,commit,live,arrays,tree}:{engine:Engine;id:string;commit:()=>void;live:()=>void;arrays:string[];tree:any}){
 const {state}=engine,b=state.doc.bands[id]
 const {t:tr}=useT()
 if(!b)return null
 if(id==='detail')return <div className="rev2-sec"><h4>{tr('designer.panel.detailLoopSource')}</h4>
  <label className="rev2-f">{tr('designer.panel.rowsFrom')}<Select size="small" showSearch value={b.dataPath} onChange={v=>{b.dataPath=v;commit()}} options={arrays.map(a=>({value:a,label:a}))}/></label>
  <div className="rev2-grid2" style={{marginTop:8}}>
   <label className="rev2-f">{tr('designer.panel.rowHeight')}<InputNumber size="small" min={10} max={200} value={b.rowH} onChange={v=>{b.rowH=v||22;commit()}}/></label>
   <label className="rev2-f">{tr('designer.panel.fontSize')}<InputNumber size="small" min={6} max={30} value={b.fontSize} onChange={v=>{b.fontSize=v||11;commit()}}/></label>
   <label className="rev2-f">{tr('designer.panel.font')}<Select size="small" value={b.fontFamily} onChange={v=>{b.fontFamily=v;commit()}} options={FONT_FAMILIES.map(f=>({value:f,label:f.split(',')[0]}))}/></label>
   <label className="rev2-f">{tr('designer.panel.textColour')}<Color value={b.color} onChange={v=>{b.color=v;live()}}/></label>
   <label className="rev2-f">{tr('designer.panel.gridColour')}<Color value={b.gridColor} onChange={v=>{b.gridColor=v;live()}}/></label>
  </div>
  <Space style={{marginTop:8}} wrap>
   <Checkbox checked={!!b.autoHeight} onChange={e=>{b.autoHeight=e.target.checked;commit()}}>{tr('designer.panel.autoHeight')}</Checkbox>
   <Checkbox checked={!!b.zebra} onChange={e=>{b.zebra=e.target.checked;commit()}}>{tr('designer.panel.zebraRows')}</Checkbox>
  </Space>
  <ColumnsEditor owner={b} commit={commit} live={live} fields={rowFields(tree,b.dataPath||'')}/>
 </div>
 if(id==='columnHeader')return <div className="rev2-sec"><h4>{tr('designer.bands.columnHeader')}</h4>
  <div className="rev2-grid2">
   <label className="rev2-f">{tr('designer.panel.height')}<InputNumber size="small" min={10} max={120} value={b.h} onChange={v=>{b.h=v||26;commit()}}/></label>
   <label className="rev2-f">{tr('designer.panel.fontSize')}<InputNumber size="small" min={6} max={30} value={b.fontSize} onChange={v=>{b.fontSize=v||undefined;commit()}} placeholder={tr('designer.panel.detailSize')}/></label>
   <label className="rev2-f">{tr('designer.panel.background')}<Color value={b.headerBg||state.doc.bands.detail.headerBg} onChange={v=>{b.headerBg=v;live()}}/></label>
   <label className="rev2-f">{tr('designer.panel.textColour')}<Color value={b.headerColor||state.doc.bands.detail.headerColor} onChange={v=>{b.headerColor=v;live()}}/></label>
  </div>
  <Space style={{marginTop:8}}>
   <Checkbox checked={b.on!==false} onChange={e=>{b.on=e.target.checked;commit()}}>{tr('designer.panel.showHeader')}</Checkbox>
   <Button size="small" type={b.bold!==false?'primary':'default'} aria-label={tr('designer.panel.bold')} icon={<BoldOutlined/>} onClick={()=>{b.bold=b.bold===false;commit()}}/>
   <Button size="small" type={b.italic?'primary':'default'} aria-label={tr('designer.panel.italic')} icon={<ItalicOutlined/>} onClick={()=>{b.italic=!b.italic;commit()}}/>
   <Button size="small" type={b.underline?'primary':'default'} aria-label={tr('designer.panel.underline')} icon={<UnderlineOutlined/>} onClick={()=>{b.underline=!b.underline;commit()}}/>
  </Space>
 </div>
 return <div className="rev2-sec"><h4>{bandName(tr,id)}</h4>
  <div className="rev2-grid2">
   <label className="rev2-f">{tr('designer.panel.heightPx')}<InputNumber size="small" min={0} max={1000} value={b.h} onChange={v=>{b.h=v??0;commit()}}/></label>
   {b.optional&&<label className="rev2-f">{tr('designer.panel.visible')}<Switch size="small" checked={b.on!==false} onChange={v=>{b.on=v;commit()}}/></label>}
  </div>
  <p className="rev2-hint" style={{marginTop:8}}>{isFreeBand(id)?tr('designer.panel.freeBandHint'):''}</p>
  {isSummaryBand(id)&&<Button size="small" danger icon={<DeleteOutlined/>} onClick={()=>state.removeSummaryBand(id)}>{tr('designer.panel.removeSection')}</Button>}
 </div>
}

/* ---------- loop columns (table element or detail band) ---------- */
function ColumnsEditor({owner,commit,live,fields}:{owner:any;commit:()=>void;live:()=>void;fields:string[]}){
 const cols:ColumnDef[]=owner.columns||[]
 const set=(i:number,patch:Partial<ColumnDef>,history=true)=>{Object.assign(cols[i],patch);history?commit():live()}
 const {t:tr}=useT(),newHeader=tr('designer.panel.newColumn')
 return <div style={{marginTop:10}}>
  <h4 style={{fontSize:11,textTransform:'uppercase',color:'#6b7686',marginBottom:6}}>{tr('designer.panel.columns')}</h4>
  {cols.map((c,i)=><div key={i} className="rev2-card">
   <div className="rev2-grid2">
    <label className="rev2-f">{tr('designer.panel.header')}<Input size="small" value={c.header} onChange={e=>set(i,{header:e.target.value},false)} onBlur={commit}/></label>
    <label className="rev2-f">{tr('designer.panel.width')}<InputNumber size="small" min={10} max={1200} value={c.width} onChange={v=>set(i,{width:v||40})}/></label>
   </div>
   <label className="rev2-f" style={{marginTop:6}}>{tr('designer.panel.cell')}<Input size="small" value={c.expr} onChange={e=>set(i,{expr:e.target.value},false)} onBlur={commit} style={{fontFamily:'monospace'}}/></label>
   {fields.length>0&&<div style={{marginTop:4}}><FieldPicker fields={fields} placeholder={tr('designer.panel.fillFromField')} onPick={f=>set(i,{expr:'{{'+f+'}}',header:c.header&&c.header!=='New'&&c.header!==newHeader?c.header:f.split('.').pop()!})}/></div>}
   <label className="rev2-f" style={{marginTop:6}}>{tr('designer.panel.totalsCell')}<Input size="small" placeholder="{{MONEY(SUM($rows.amount))}}" value={c.footer||''} onChange={e=>set(i,{footer:e.target.value},false)} onBlur={commit} style={{fontFamily:'monospace'}}/></label>
   <Space style={{marginTop:6,justifyContent:'space-between',width:'100%'}}>
    <Radio.Group size="small" optionType="button" options={aligns(tr)} value={c.align} onChange={e=>set(i,{align:e.target.value})}/>
    <Button size="small" danger type="text" aria-label={tr('designer.panel.removeColumn')} icon={<DeleteOutlined/>} onClick={()=>{owner.columns=cols.filter((_,j)=>j!==i);commit()}}/>
   </Space>
  </div>)}
  <Button size="small" icon={<PlusOutlined/>} onClick={()=>{owner.columns=[...cols,{header:newHeader,expr:'{{ }}',width:80,align:'left'}];commit()}}>{tr('designer.panel.addColumn')}</Button>
 </div>
}

/* ---------- fixed (single-record) grid ---------- */
function FixedGridEditor({e,commit,live,fields}:{e:ReportElement;commit:()=>void;live:()=>void;fields:string[]}){
 const cols=e.gridCols||[],rows=e.gridRows||[]
 const newCell=():FixedCell=>({expr:'',align:'left'})
 const {t:tr}=useT()
 return <div style={{marginTop:8}}>
  <h4 style={{fontSize:11,textTransform:'uppercase',color:'#6b7686',marginBottom:6}}>{tr('designer.panel.columnsCount',{n:cols.length})}</h4>
  <Space wrap size={4}>
   {cols.map((w,j)=><InputNumber key={j} size="small" min={20} max={1200} style={{width:70}} value={w} onChange={v=>{cols[j]=v||40;live()}} onBlur={commit}/>)}
   <Button size="small" aria-label={tr('designer.panel.addColumn')} icon={<PlusOutlined/>} onClick={()=>{e.gridCols=[...cols,100];e.gridRows=rows.map(r=>[...r,newCell()]);commit()}}/>
   <Button size="small" aria-label={tr('designer.panel.removeLastColumn')} disabled={cols.length<=1} onClick={()=>{e.gridCols=cols.slice(0,-1);e.gridRows=rows.map(r=>r.slice(0,-1));commit()}}>−</Button>
  </Space>
  <h4 style={{fontSize:11,textTransform:'uppercase',color:'#6b7686',margin:'10px 0 6px'}}>{tr('designer.panel.rows')}</h4>
  {rows.map((r,ri)=><div key={ri} className="rev2-card">
   {cols.map((_,j)=>{const c=r[j]??(r[j]=newCell());return <div key={j} style={{display:'flex',gap:4,marginBottom:4}}>
    <Input size="small" value={c.expr} placeholder={tr('designer.panel.cellN',{n:j+1})} onChange={ev=>{c.expr=ev.target.value;live()}} onBlur={commit} style={{fontFamily:'monospace'}}/>
    <Tooltip title={tr('designer.panel.bold')}><Button size="small" type={c.bold?'primary':'default'} icon={<BoldOutlined/>} onClick={()=>{c.bold=!c.bold;commit()}}/></Tooltip>
    <Select size="small" style={{width:76}} value={c.align||'left'} options={aligns(tr)} onChange={v=>{c.align=v;commit()}}/>
    {fields.length>0&&<Select size="small" showSearch placeholder="{{ }}" value={null} style={{width:60}} popupMatchSelectWidth={260} options={fields.map(f=>({value:f,label:f}))} onChange={f=>{if(f){c.expr='{{'+f+'}}';commit()}}}/>}
   </div>})}
   <Button size="small" danger type="text" icon={<DeleteOutlined/>} onClick={()=>{e.gridRows=rows.filter((_,i)=>i!==ri);commit()}}>{tr('designer.panel.row')}</Button>
  </div>)}
  <Button size="small" icon={<PlusOutlined/>} onClick={()=>{e.gridRows=[...rows,cols.map(()=>newCell())];commit()}}>{tr('designer.panel.addRow')}</Button>
 </div>
}

/* ---------- element selected ---------- */
function ElementProps({engine,e,commit,live,arrays,tree,recordFields}:{engine:Engine;e:ReportElement;commit:()=>void;live:()=>void;arrays:string[];tree:any;recordFields:string[]}){
 const {state:st}=engine
 const {t:tr}=useT()
 const textLike=e.type==='text'||e.type==='field'
 const fixedTable=e.type==='table'&&e.tableMode==='fixed'
 const num=(k:'x'|'y'|'w'|'h')=><label className="rev2-f">{k.toUpperCase()}<InputNumber size="small" value={e[k]} onChange={v=>{e[k]=v??0;commit()}} disabled={k==='h'&&!!e.autoHeight&&['table','text','field'].includes(e.type)}/></label>
 const list=()=>e.band?(st.doc.bands[e.band].elements as ReportElement[]):st.elements
 const textArea=useRef<any>(null)
 // Usable width: inside the page margins, or the whole band width in a flowing report (bands are already inset).
 const area=():[number,number]=>{const p:any=st.doc.page;return e.band?[0,p.w-2*p.margin]:[p.margin,p.w-2*p.margin]}
 const insert=(field:string)=>{e.text=(e.text||'')+'{{'+field+'}}';commit()}
 const upload=(file:File)=>{
  if(!IMAGE_TYPES.includes(file.type)){message.error(tr('designer.imageTypeError'));return false}
  if(file.size>1024*1024){message.error(tr('designer.panel.imageTooLarge'));return false}
  const r=new FileReader();r.onload=()=>{e.src=String(r.result);commit()};r.readAsDataURL(file);return false
 }
 return <>
  <div className="rev2-sec"><h4>{e.band?tr('designer.panel.inBand',{type:TYPE_KEYS.includes(e.type)?tr('designer.elementTypes.'+e.type):e.type,band:bandName(tr,e.band)}):TYPE_KEYS.includes(e.type)?tr('designer.elementTypes.'+e.type):e.type}</h4>
   <div className="rev2-grid4">{num('x')}{num('y')}{num('w')}{num('h')}</div>
   {['table','text','field'].includes(e.type)&&<Checkbox style={{marginTop:6}} checked={!!e.autoHeight} onChange={ev=>{e.autoHeight=ev.target.checked;commit()}}>{tr('designer.panel.growToFit')}</Checkbox>}
   <Space style={{marginTop:8}}>
    <Button size="small" icon={<CopyOutlined/>} onClick={()=>{const c:ReportElement=JSON.parse(JSON.stringify(e));c.id=nid();c.x+=14;c.y+=14;list().push(c);st.selId=c.id;commit()}}>{tr('designer.templates.duplicate')}</Button>
    <Button size="small" icon={<VerticalAlignTopOutlined/>} onClick={()=>{const a=list(),i=a.indexOf(e);if(i>=0){a.splice(i,1);a.push(e)}commit()}}>{tr('designer.panel.toFront')}</Button>
    <Button size="small" danger icon={<DeleteOutlined/>} onClick={()=>st.deleteSel()}>{tr('common.delete')}</Button>
   </Space>
   <Space style={{marginTop:6}}>
    <Tooltip title={tr('designer.panel.centreTip')}><Button size="small" icon={<VerticalAlignMiddleOutlined rotate={90}/>} onClick={()=>{const [x0,w]=area();e.x=Math.round(x0+(w-e.w)/2);commit()}}>{tr('designer.panel.centre')}</Button></Tooltip>
    <Tooltip title={tr('designer.panel.fullWidthTip')}><Button size="small" icon={<ColumnWidthOutlined/>} onClick={()=>{const [x0,w]=area();e.x=x0;e.w=w;commit()}}>{tr('designer.panel.fullWidth')}</Button></Tooltip>
   </Space>
  </div>

  {textLike&&<div className="rev2-sec"><h4>{e.type==='field'?tr('designer.panel.expression'):tr('designer.elementTypes.text')}</h4>
   <Input.TextArea ref={textArea} autoSize={{minRows:2,maxRows:8}} value={e.text} onChange={ev=>{e.text=ev.target.value;live()}} onBlur={()=>st.pushHistory()} style={{fontFamily:e.type==='field'?'monospace':undefined}}/>
   <div style={{marginTop:6}}><FieldPicker fields={recordFields} onPick={insert}/></div>
   <p className="rev2-hint" style={{marginTop:6}}>{tr('designer.panel.exprHint',{path:'{{path}}',examples:'{{MONEY(details.amount)}}, {{DATE(details.date)}}, {{UPPER(title)}}',last:"{{IF(details.voided,'VOID','')}}"})}</p>
  </div>}

  {(e.type==='barcode'||e.type==='qrcode')&&<div className="rev2-sec"><h4>{e.type==='barcode'?tr('designer.panel.barcodeValue'):tr('designer.panel.qrValue')}</h4>
   <Input size="small" value={e.text} onChange={ev=>{e.text=ev.target.value;live()}} onBlur={()=>st.pushHistory()} style={{fontFamily:'monospace'}}/>
   <div style={{marginTop:6}}><FieldPicker fields={recordFields} onPick={f=>{e.text='{{'+f+'}}';commit()}} placeholder={tr('designer.panel.bindToField')}/></div>
   {e.type==='barcode'&&<Checkbox style={{marginTop:6}} checked={e.showText!==false} onChange={ev=>{e.showText=ev.target.checked;commit()}}>{tr('designer.panel.showTextUnderBars')}</Checkbox>}
   <label className="rev2-f" style={{marginTop:6}}>{tr('designer.panel.colour')}<Color value={e.color} onChange={v=>{e.color=v;live()}}/></label>
  </div>}

  {e.type==='image'&&<div className="rev2-sec"><h4>{tr('designer.panel.imageSource')}</h4>
   <Space wrap>
    <Upload accept={IMAGE_TYPES.join(',')} showUploadList={false} beforeUpload={upload}><Button size="small">{tr('designer.panel.uploadImage')}</Button></Upload>
    {e.src&&<Button size="small" onClick={()=>{e.src='';commit()}}>{tr('common.clear')}</Button>}
   </Space>
   <label className="rev2-f" style={{marginTop:8}}>{tr('designer.panel.imageUrl',{token:'{{field}}'})}<Input size="small" value={e.src?.startsWith('data:')?tr('designer.panel.uploadedImage'):e.src} disabled={e.src?.startsWith('data:')} onChange={ev=>{e.src=ev.target.value;live()}} onBlur={()=>st.pushHistory()}/></label>
   <p className="rev2-hint" style={{marginTop:6}}>{tr('designer.panel.imageHint')}</p>
  </div>}

  {e.type==='table'&&<div className="rev2-sec"><h4>{tr('designer.elementTypes.table')}</h4>
   <Radio.Group size="small" optionType="button" value={fixedTable?'fixed':'loop'} options={[{value:'loop',label:tr('designer.panel.loopRows')},{value:'fixed',label:tr('designer.panel.fixedGrid')}]} onChange={ev=>{
    e.tableMode=ev.target.value
    if(e.tableMode==='fixed'){if(!e.gridCols?.length)e.gridCols=[120,220];if(!e.gridRows?.length)e.gridRows=[[{expr:tr('designer.panel.cellLabel'),bold:true},{expr:'{{ }}'}],[{expr:tr('designer.panel.cellLabel'),bold:true},{expr:'{{ }}'}]]}
    commit()}}/>
   {fixedTable?<FixedGridEditor e={e} commit={commit} live={live} fields={recordFields}/>:<>
    <label className="rev2-f" style={{marginTop:8}}>{tr('designer.panel.rowsFrom')}<Select size="small" showSearch value={e.dataPath} onChange={v=>{e.dataPath=v;commit()}} options={arrays.map(a=>({value:a,label:a}))}/></label>
    <Space wrap style={{marginTop:8}}>
     <Checkbox checked={!!e.showHeader} onChange={ev=>{e.showHeader=ev.target.checked;commit()}}>{tr('designer.panel.headerRow')}</Checkbox>
     <Checkbox checked={!!e.showFooter} onChange={ev=>{e.showFooter=ev.target.checked;commit()}}>{tr('designer.panel.totalsRow')}</Checkbox>
     <Checkbox checked={!!e.zebra} onChange={ev=>{e.zebra=ev.target.checked;commit()}}>{tr('designer.panel.zebra')}</Checkbox>
    </Space>
    <div className="rev2-grid2" style={{marginTop:8}}>
     <label className="rev2-f">{tr('designer.panel.headerFill')}<Color value={e.headerBg} onChange={v=>{e.headerBg=v;live()}}/></label>
     <label className="rev2-f">{tr('designer.panel.headerText')}<Color value={e.headerColor} onChange={v=>{e.headerColor=v;live()}}/></label>
    </div>
    <ColumnsEditor owner={e} commit={commit} live={live} fields={rowFields(tree,e.dataPath||'')}/>
   </>}
   <label className="rev2-f" style={{marginTop:8}}>{tr('designer.panel.gridColour')}<Color value={e.gridColor} onChange={v=>{e.gridColor=v;live()}}/></label>
  </div>}

  {(textLike||e.type==='table')&&<div className="rev2-sec"><h4>{tr('designer.panel.typography')}</h4>
   <div className="rev2-grid2">
    <label className="rev2-f">{tr('designer.panel.font')}<Select size="small" value={e.fontFamily} onChange={v=>{e.fontFamily=v;commit()}} options={FONT_FAMILIES.map(f=>({value:f,label:f.split(',')[0]}))}/></label>
    <label className="rev2-f">{tr('designer.panel.fontSize')}<InputNumber size="small" min={5} max={120} value={e.fontSize} onChange={v=>{e.fontSize=v||12;commit()}}/></label>
    <label className="rev2-f">{tr('designer.panel.colour')}<Color value={e.color} onChange={v=>{e.color=v;live()}}/></label>
    {textLike&&<label className="rev2-f">{tr('designer.panel.valign')}<Select size="small" value={e.valign||'center'} onChange={v=>{e.valign=v;commit()}} options={[{value:'top',label:tr('designer.panel.top')},{value:'center',label:tr('designer.panel.middle')},{value:'bottom',label:tr('designer.panel.bottom')}]}/></label>}
   </div>
   {textLike&&<Space style={{marginTop:8}}>
    <Button size="small" type={e.bold?'primary':'default'} aria-label={tr('designer.panel.bold')} icon={<BoldOutlined/>} onClick={()=>{e.bold=!e.bold;commit()}}/>
    <Button size="small" type={e.italic?'primary':'default'} aria-label={tr('designer.panel.italic')} icon={<ItalicOutlined/>} onClick={()=>{e.italic=!e.italic;commit()}}/>
    <Button size="small" type={e.underline?'primary':'default'} aria-label={tr('designer.panel.underline')} icon={<UnderlineOutlined/>} onClick={()=>{e.underline=!e.underline;commit()}}/>
    <Radio.Group size="small" optionType="button" options={aligns(tr)} value={e.align} onChange={ev=>{e.align=ev.target.value;commit()}}/>
   </Space>}
  </div>}

  {e.type==='line'?<div className="rev2-sec"><h4>{tr('designer.elementTypes.line')}</h4>
   <div className="rev2-grid2">
    <label className="rev2-f">{tr('designer.panel.direction')}<Select size="small" value={e.lineDir||'h'} options={[{value:'h',label:tr('designer.panel.horizontal')},{value:'v',label:tr('designer.panel.vertical')}]} onChange={v=>{e.lineDir=v;if(v==='v'){const w=e.w;e.w=e.h||2;e.h=Math.max(20,w)}else{const h=e.h;e.h=e.w||2;e.w=Math.max(20,h)}commit()}}/></label>
    <label className="rev2-f">{tr('designer.panel.thickness')}<InputNumber size="small" min={1} max={40} value={(e.lineDir||'h')==='h'?e.h:e.w} onChange={v=>{if((e.lineDir||'h')==='h')e.h=v||2;else e.w=v||2;commit()}}/></label>
    <label className="rev2-f">{tr('designer.panel.colour')}<Color value={e.bg} onChange={v=>{e.bg=v;live()}}/></label>
   </div>
  </div>:e.type!=='table'&&<div className="rev2-sec"><h4>{tr('designer.panel.boxFill')}</h4>
   <div className="rev2-grid2">
    <label className="rev2-f">{tr('designer.panel.fill')}<Color value={e.bg} allowNone onChange={v=>{e.bg=v;live()}}/></label>
    <label className="rev2-f">{tr('designer.panel.borderColour')}<Color value={e.borderColor} onChange={v=>{e.borderColor=v;live()}}/></label>
    <label className="rev2-f">{tr('designer.panel.borderWidth')}<InputNumber size="small" min={0} max={20} value={e.borderW} onChange={v=>{e.borderW=v??0;commit()}}/></label>
    <label className="rev2-f">{tr('designer.panel.borderStyle')}<Select size="small" value={e.borderStyle||'solid'} options={['solid','dashed','dotted'].map(v=>({value:v,label:tr('designer.panel.'+v)}))} onChange={v=>{e.borderStyle=v;commit()}}/></label>
    <label className="rev2-f">{tr('designer.panel.radius')}<InputNumber size="small" min={0} max={200} value={e.radius} onChange={v=>{e.radius=v??0;commit()}}/></label>
    <label className="rev2-f">{tr('designer.panel.padding')}<InputNumber size="small" min={0} max={100} value={e.padding} onChange={v=>{e.padding=v??0;commit()}}/></label>
   </div>
  </div>}
 </>
}

/* ---------- variables ---------- */
function VariableTree({engine,data}:{engine:Engine;data:any}){
 const {state}=engine
 const {t:tr}=useT()
 const [search,setSearch]=useState(''),[open,setOpen]=useState<Record<string,boolean>>({})
 const leaves=useMemo(()=>{
  const out:string[]=[]
  const walk=(o:any,prefix:string,depth:number)=>{if(!o||typeof o!=='object'||depth>6)return;const src=Array.isArray(o)?(o[0]||{}):o;for(const k of Object.keys(src)){const v=src[k],p=prefix?prefix+'.'+k:k;if(v&&typeof v==='object')walk(v,p,depth+1);else out.push(p)}}
  walk(data,'',0);return out
 },[data])
 const startDrag=(ev:React.PointerEvent,path:string)=>{
  ev.preventDefault()
  const sx=ev.clientX,sy=ev.clientY;let ghost:HTMLDivElement|null=null
  const move=(m:PointerEvent)=>{
   if(!ghost){if(Math.abs(m.clientX-sx)+Math.abs(m.clientY-sy)<5)return
    ghost=document.createElement('div');ghost.textContent='{{'+path+'}}'
    ghost.style.cssText='position:fixed;z-index:2000;pointer-events:none;background:#10271f;color:#fff;padding:3px 8px;border-radius:6px;font:600 11px/1.2 ui-monospace,monospace;white-space:nowrap'
    document.body.appendChild(ghost)}
   ghost.style.left=m.clientX+10+'px';ghost.style.top=m.clientY+12+'px'
  }
  const up=(u:PointerEvent)=>{
   document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up)
   if(!ghost){state.insertToken(path);return}
   ghost.remove()
   const sheet=(document.elementFromPoint(u.clientX,u.clientY) as HTMLElement|null)?.closest('.rev2-sheet[data-editsheet="1"]')
   if(!sheet)return
   const r=sheet.getBoundingClientRect(),z=state.zoom||1
   state.dropBind(path,(u.clientX-r.left)/z,(u.clientY-r.top)/z)
  }
  document.addEventListener('pointermove',move);document.addEventListener('pointerup',up)
 }
 const leaf=(key:string,path:string,v:any)=><div key={path} className="rev2-tlabel rev2-tleaf" style={{touchAction:'none'}} onPointerDown={ev=>startDrag(ev,path)} title={'{{'+path+'}}'+(v!==undefined&&v!==null?' = '+String(v).slice(0,60):'')}>
  <span className="rev2-tw"/><span className="rev2-tn">{key}</span><span className="rev2-tt">{v===null?'null':typeof v}</span>
 </div>
 const nodes=(obj:any,prefix:string,depth:number):React.ReactNode=>Object.keys(obj||{}).map(k=>{
  const v=obj[k],p=prefix?prefix+'.'+k:k,arr=Array.isArray(v)
  if(!(v&&typeof v==='object'))return leaf(k,p,v)
  const closed=!open[p]
  return <div key={p}>
   <div className="rev2-tlabel" onClick={()=>setOpen(o=>({...o,[p]:!o[p]}))}><span className="rev2-tw">{closed?'▸':'▾'}</span><span className="rev2-tn">{k}</span><span className={'rev2-tt'+(arr?' rev2-arr':'')}>{arr?'['+v.length+']':'{}'}</span></div>
   {!closed&&<div className="rev2-tchildren">
    {arr&&<div className="rev2-hint" style={{padding:'2px 6px'}}>{tr('designer.vars.rowFieldsHint',{path:'\u0000'}).split('\u0000').flatMap((part,i)=>i?[<code key={i}>{p}</code>,part]:[part])}</div>}
    {depth<6&&nodes(arr?(v[0]||{}):v,arr?'':p,depth+1)}
   </div>}
  </div>
 })
 const matches=search.trim()?leaves.filter(l=>l.toLowerCase().includes(search.trim().toLowerCase())).slice(0,200):[]
 return <div className="rev2-tree" style={{padding:'8px 6px'}}>
  <Input size="small" allowClear placeholder={tr('designer.vars.search')} value={search} onChange={e=>setSearch(e.target.value)}/>
  <p className="rev2-hint" style={{padding:'6px 4px'}}>{state.doc.mode==='batch'?tr('designer.vars.firstRecord')+' ':''}{tr('designer.vars.hint')}</p>
  {search.trim()?(matches.length?matches.map(m=>leaf(m,m,undefined)):<p className="rev2-hint">{tr('designer.vars.noMatch')}</p>):nodes(data,'',0)}
 </div>
}
