import {useEffect,useState,type ReactNode} from 'react'
import {Alert,Button,Checkbox,Form,Input,Radio,Spin,Tag,message} from 'antd'
import {AimOutlined,CalendarOutlined,CheckCircleFilled,ClockCircleOutlined,EditOutlined,EnvironmentOutlined,InboxOutlined} from '@ant-design/icons'
import {mapsUrl,publicPackingApi,type PackingLinkPurpose,type PublicPackingJob} from '../packingApi'
import {formatDate,formatDateTime,formatLocale,t as translate,useT} from '../i18n'

/** ISO (UTC) ⇄ the value of a datetime-local input in the customer's own time zone. */
const toLocal=(iso:string)=>{const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
const when=(v:string|null)=>v?formatDateTime(v):''
const fail=(e:unknown,fallback:string)=>message.error(e instanceof Error?e.message:fallback)

function usePublicJob(token:string){
 const [data,setData]=useState<PublicPackingJob>(),[error,setError]=useState('')
 useEffect(()=>{publicPackingApi.get(token).then(setData).catch(e=>setError(e instanceof Error?e.message:translate('customer.links.notAvailable')))},[token])
 return {data,setData,error}
}

/** Common frame of the customer link pages; `variant` gives each page its own colour and hero. */
function Shell({variant,purpose,icon,title,subtitle,data,error,children}:{variant:string;purpose:PackingLinkPurpose;icon:ReactNode;title:string;subtitle:string;data?:PublicPackingJob;error:string;children?:ReactNode}){
 const {t}=useT()
 return <main className={'customer-link customer-link--'+variant}>
  <div className="customer-link-card">
   <header className="customer-link-hero">
    <span className="customer-link-icon">{icon}</span>
    <div><small>{data?.tenantName??' '}</small><h1>{title}</h1><p>{subtitle}</p></div>
   </header>
   {error?<div className="customer-link-body"><Alert type="warning" showIcon title={t('customer.links.notAvailable')} description={error}/></div>
    :!data?<div className="customer-link-body customer-link-loading"><Spin aria-label={t('customer.links.loading')}/></div>
    :data.purpose!==purpose?<div className="customer-link-body"><Alert type="warning" showIcon title={t('customer.links.wrongPurpose')}/></div>
    :<>
     <div className="customer-link-ref"><div><span>{t('common.customer')}</span><strong>{data.customerName}</strong></div><div><span>{t('customer.packingLink.reference')}</span><strong>{data.jobNumber}</strong></div></div>
     <div className="customer-link-body">{data.status==='CANCELLED'?<Alert type="info" showIcon title={t('customer.packingLink.cancelled')}/>:children}</div>
     <footer className="customer-link-footer">{t('customer.links.validUntil',{company:data.tenantName,date:when(data.expiresAtUtc)})}</footer>
    </>}
  </div>
 </main>
}

/* ---------------- 1. confirm the packing date ---------------- */
export function CustomerPackingDatePage({token}:{token:string}){
 const {t}=useT()
 const {data,setData,error}=usePublicJob(token)
 const [changing,setChanging]=useState(false),[time,setTime]=useState(''),[busy,setBusy]=useState(false)
 const save=async(iso:string)=>{
  setBusy(true)
  try{setData(await publicPackingApi.confirmSchedule(token,{scheduledAtUtc:iso}));setChanging(false);message.success(t('customer.packingLink.dateConfirmed'))}
  catch(e){fail(e,t('customer.packingLink.dateFailed'))}finally{setBusy(false)}
 }
 const d=data?new Date(data.scheduledAtUtc):null,closed=data?.status==='COMPLETED'
 return <Shell variant="date" purpose="SCHEDULE" icon={<CalendarOutlined/>} title={t('customer.packingLink.dateTitle')} subtitle={t('customer.packingLink.dateSubtitle')} data={data} error={error}>
  {data&&d&&<>
   {data.scheduleConfirmedAtUtc&&<div className="customer-link-done"><CheckCircleFilled/><div><strong>{t('customer.packingLink.dateDone')}</strong><span>{t('customer.links.confirmedOn',{date:when(data.scheduleConfirmedAtUtc)})}</span></div></div>}
   <div className="customer-date-block">
    <div className="customer-date-day"><span>{formatDate(d,{month:'short'}).toLocaleUpperCase(formatLocale())}</span><strong>{d.getDate()}</strong></div>
    <div className="customer-date-text"><strong>{formatDate(d,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</strong><span><ClockCircleOutlined/> {formatDate(d,{hour:'numeric',minute:'2-digit'})}</span><span><EnvironmentOutlined/> {data.address}</span></div>
   </div>
   {closed?<Alert type="success" showIcon title={t('customer.packingLink.completed')}/>:changing?<div className="customer-date-change">
     <label><span>{t('customer.packingLink.chooseAnotherLabel')}</span><Input type="datetime-local" size="large" value={time} min={toLocal(new Date().toISOString())} onChange={e=>setTime(e.target.value)}/></label>
     <div className="customer-link-actions"><Button size="large" onClick={()=>setChanging(false)}>{t('common.back')}</Button><Button type="primary" size="large" loading={busy} disabled={!time} onClick={()=>void save(new Date(time).toISOString())}>{t('customer.packingLink.confirmNew')}</Button></div>
    </div>
    :<div className="customer-link-actions">
     <Button size="large" icon={<EditOutlined/>} onClick={()=>{setTime(toLocal(data.scheduledAtUtc));setChanging(true)}}>{t('customer.packingLink.chooseAnother')}</Button>
     <Button type="primary" size="large" loading={busy} disabled={Boolean(data.scheduleConfirmedAtUtc)} onClick={()=>void save(data.scheduledAtUtc)}>{data.scheduleConfirmedAtUtc?t('customer.links.confirmed'):t('customer.packingLink.yesWorks')}</Button>
    </div>}
  </>}
 </Shell>
}

/* ---------------- 2. share the packing location ---------------- */
export function CustomerPackingLocationPage({token}:{token:string}){
 const {t}=useT()
 const {data,setData,error}=usePublicJob(token)
 const [pos,setPos]=useState<{latitude:number;longitude:number;accuracy?:number}>(),[address,setAddress]=useState(''),[notes,setNotes]=useState(''),[busy,setBusy]=useState<'gps'|'save'|null>(null)
 useEffect(()=>{if(!data)return;setAddress(data.address);setNotes(data.locationNotes??'');if(data.latitude!=null&&data.longitude!=null)setPos(p=>p??{latitude:data.latitude!,longitude:data.longitude!})},[data])
 const locate=()=>{
  if(!navigator.geolocation){message.error(t('customer.links.locationUnsupported'));return}
  setBusy('gps')
  navigator.geolocation.getCurrentPosition(p=>{setPos({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy});setBusy(null)},
   ()=>{setBusy(null);message.error(t('customer.links.allowLocation'))},{enableHighAccuracy:true,timeout:20000})
 }
 const save=async()=>{
  if(!pos)return
  setBusy('save')
  try{setData(await publicPackingApi.shareLocation(token,{latitude:pos.latitude,longitude:pos.longitude,address:address.trim()||undefined,notes:notes.trim()||undefined}));message.success(t('customer.packingLink.locationShared'))}
  catch(e){fail(e,t('customer.packingLink.locationFailed'))}finally{setBusy(null)}
 }
 const box=pos?[pos.longitude-.004,pos.latitude-.0025,pos.longitude+.004,pos.latitude+.0025].map(x=>x.toFixed(6)).join(','):''
 const closed=data?.status==='COMPLETED'
 return <Shell variant="location" purpose="LOCATION" icon={<EnvironmentOutlined/>} title={t('customer.packingLink.locationTitle')} subtitle={t('customer.packingLink.locationSubtitle')} data={data} error={error}>
  {data&&<>
   {data.locationSharedAtUtc&&<div className="customer-link-done"><CheckCircleFilled/><div><strong>{t('customer.packingLink.locationDone')}</strong><span>{t(closed?'customer.packingLink.sharedOn':'customer.packingLink.sharedOnCanUpdate',{date:when(data.locationSharedAtUtc)})}</span></div></div>}
   <div className={'customer-map'+(pos?'':' is-empty')}>
    {pos?<iframe title={t('customer.links.mapTitle')} loading="lazy" src={'https://www.openstreetmap.org/export/embed.html?bbox='+box+'&layer=mapnik&marker='+pos.latitude.toFixed(6)+','+pos.longitude.toFixed(6)}/>
     :<div><EnvironmentOutlined/><span>{t('customer.packingLink.mapEmpty')}</span></div>}
   </div>
   {pos&&<p className="customer-map-caption">{pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}{pos.accuracy?' · '+t('customer.links.accuracy',{meters:Math.round(pos.accuracy)}):''} · <a href={mapsUrl(address,pos.latitude,pos.longitude)} target="_blank" rel="noopener noreferrer">{t('customer.links.openMaps')}</a></p>}
   {!closed&&<>
    <Button block size="large" className="customer-gps-button" icon={<AimOutlined/>} loading={busy==='gps'} onClick={locate}>{pos?t('customer.links.useLocationAgain'):t('customer.links.useLocation')}</Button>
    <label className="customer-field"><span>{t('customer.packingLink.addressLabel')}</span><Input.TextArea rows={2} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)} placeholder={t('customer.packingLink.addressPlaceholder')}/></label>
    <label className="customer-field"><span>{t('customer.packingLink.directionsLabel')} <em>{t('customer.links.optional')}</em></span><Input.TextArea rows={2} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={t('customer.links.directionsPlaceholder')}/></label>
    <Button block type="primary" size="large" loading={busy==='save'} disabled={!pos} onClick={()=>void save()}>{data.locationSharedAtUtc?t('customer.packingLink.updateLocation'):t('customer.packingLink.sendLocation')}</Button>
   </>}
  </>}
 </Shell>
}

/* ---------------- 3. confirm the packed items ---------------- */
export function CustomerPackingItemsPage({token}:{token:string}){
 const {t}=useT()
 const {data,setData,error}=usePublicJob(token)
 const [form]=Form.useForm(),confirmed=Form.useWatch('confirmed',form),[busy,setBusy]=useState(false)
 const respond=async(v:{name:string;confirmed:boolean;notes?:string})=>{
  if(!data?.itemsHash)return
  setBusy(true)
  try{setData(await publicPackingApi.respond(token,{name:v.name,confirmed:v.confirmed,notes:v.notes,snapshotHash:data.itemsHash}));form.resetFields();message.success(t('customer.packingLink.responseRecorded'))}
  catch(e){fail(e,t('customer.packingLink.saveFailed'))}finally{setBusy(false)}
 }
 const answered=data?.itemsResponse&&data.itemsResponseCurrent
 const count=data?.boxes.reduce((n,b)=>n+b.items.reduce((m,i)=>m+i.quantity,0),0)??0
 return <Shell variant="items" purpose="ITEMS" icon={<InboxOutlined/>} title={t('customer.packingLink.itemsTitle')} subtitle={t('customer.packingLink.itemsSubtitle')} data={data} error={error}>
  {data&&<>
   <div className="customer-items-summary"><div><strong>{data.boxes.length}</strong><span>{t('customer.packingLink.boxes')}</span></div><div><strong>{count}</strong><span>{t('customer.packingLink.items')}</span></div><div><strong>{data.boxes.filter(b=>b.isFragile).length}</strong><span>{t('customer.packingLink.fragile')}</span></div></div>
   {data.boxes.map((b,index)=><article className="customer-box" key={b.trackingNumber}>
    <header><span className="customer-box-no">{index+1}</span><div><strong>{b.trackingNumber}</strong><small>{b.boxTypeName}{b.roomName?' · '+b.roomName:''}</small></div>{b.isFragile&&<Tag color="red">{t('customer.shared.fragile')}</Tag>}</header>
    <ul>{b.items.length?b.items.map((i,n)=><li key={n}><span>{i.itemName}{i.notes&&<small> · {i.notes}</small>}</span><strong>× {i.quantity}</strong></li>):<li><span>{t('customer.packingLink.noItemDetails')}</span></li>}</ul>
   </article>)}
   <div className="customer-items-response">
    {answered?<div className={'customer-link-done'+(data.itemsResponse==='CORRECTIONS'?' is-warning':'')}><CheckCircleFilled/><div>
      <strong>{data.itemsResponse==='CONFIRMED'?t('customer.packingLink.doneConfirmed'):t('customer.packingLink.doneCorrections')}</strong>
      <span>{data.itemsResponderName} · {when(data.itemsRespondedAtUtc)}</span>{data.itemsResponseNotes&&<p className="packing-preserve-lines">{data.itemsResponseNotes}</p>}</div></div>
    :<>
     {data.itemsResponse&&<Alert style={{marginBottom:16}} type="info" showIcon title={t('customer.packingLink.updatedSince')}/>}
     <Form form={form} layout="vertical" onFinish={v=>void respond(v)} disabled={busy} requiredMark={false}>
      <Form.Item name="confirmed" label={t('customer.packingLink.correctQuestion')} rules={[{required:true,message:t('customer.packingLink.correctRequired')}]}><Radio.Group className="customer-choice" options={[{value:true,label:t('customer.packingLink.yesCorrect')},{value:false,label:t('customer.packingLink.noCorrections')}]}/></Form.Item>
      <Form.Item name="notes" label={confirmed===false?t('customer.packingLink.whatCorrect'):t('customer.packingLink.commentsOptional')} rules={confirmed===false?[{required:true,whitespace:true,message:t('customer.packingLink.correctionsRequired')}]:[]}><Input.TextArea rows={3} maxLength={2000} showCount/></Form.Item>
      <Form.Item name="name" label={t('customer.packingLink.yourName')} rules={[{required:true,whitespace:true,message:t('customer.packingLink.nameRequired')}]}><Input size="large" maxLength={160} autoComplete="name"/></Form.Item>
      <Form.Item name="authorized" valuePropName="checked" rules={[{validator:(_,v)=>v?Promise.resolve():Promise.reject(new Error(t('customer.packingLink.authorizeRequired')))}]}><Checkbox>{t('customer.packingLink.authorizeText')}</Checkbox></Form.Item>
      <Button block type="primary" size="large" htmlType="submit" loading={busy}>{t('customer.packingLink.send')}</Button>
     </Form>
    </>}
   </div>
  </>}
 </Shell>
}
