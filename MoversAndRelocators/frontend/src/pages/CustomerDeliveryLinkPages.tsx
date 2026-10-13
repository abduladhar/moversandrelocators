import {useEffect,useState,type ReactNode} from 'react'
import {Alert,Button,Input,Spin,message} from 'antd'
import {AimOutlined,CalendarOutlined,CheckCircleFilled,ClockCircleOutlined,EditOutlined,EnvironmentOutlined,InboxOutlined} from '@ant-design/icons'
import {publicDeliveryApi,type DeliveryLinkPurpose,type PublicDeliveryNote} from '../deliveryApi'
import {mapsUrl} from '../packingApi'
import {formatDate,formatDateTime,formatLocale,t as translate,useT} from '../i18n'

/** ISO (UTC) ⇄ the value of a datetime-local input in the customer's own time zone. */
const toLocal=(iso:string)=>{const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
const when=(v:string|null)=>v?formatDateTime(v):''
const fail=(e:unknown,fallback:string)=>message.error(e instanceof Error?e.message:fallback)

function usePublicNote(token:string){
 const [data,setData]=useState<PublicDeliveryNote>(),[error,setError]=useState('')
 useEffect(()=>{publicDeliveryApi.get(token).then(setData).catch(e=>setError(e instanceof Error?e.message:translate('customer.links.notAvailable')))},[token])
 return {data,setData,error}
}

/** Common frame of the delivery link pages (same look as the packing customer pages). */
function Shell({variant,purpose,icon,title,subtitle,data,error,children}:{variant:string;purpose:DeliveryLinkPurpose;icon:ReactNode;title:string;subtitle:string;data?:PublicDeliveryNote;error:string;children?:ReactNode}){
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
     <div className="customer-link-ref"><div><span>{t('common.customer')}</span><strong>{data.customerName}</strong></div><div><span>{t('customer.delivery.reference')}</span><strong>{data.noteNumber}</strong></div></div>
     <div className="customer-link-body">{data.status==='CANCELLED'?<Alert type="info" showIcon title={t('customer.delivery.cancelled')}/>:children}</div>
     <footer className="customer-link-footer">{t('customer.links.validUntil',{company:data.tenantName,date:when(data.expiresAtUtc)})}</footer>
    </>}
  </div>
 </main>
}

/* ---------------- 1. confirm the delivery date ---------------- */
export function CustomerDeliveryDatePage({token}:{token:string}){
 const {t}=useT()
 const {data,setData,error}=usePublicNote(token)
 const [changing,setChanging]=useState(false),[time,setTime]=useState(''),[busy,setBusy]=useState(false)
 const save=async(confirmed:boolean,preferredAtUtc?:string)=>{
  setBusy(true)
  try{setData(await publicDeliveryApi.respondDate(token,{confirmed,preferredAtUtc}));setChanging(false);message.success(confirmed?t('customer.delivery.dateConfirmed'):t('customer.delivery.preferredSent'))}
  catch(e){fail(e,t('customer.delivery.sendFailed'))}finally{setBusy(false)}
 }
 const d=data?new Date(data.scheduledAtUtc):null,answered=data?.dateResponseCurrent
 return <Shell variant="date" purpose="SCHEDULE" icon={<CalendarOutlined/>} title={t('customer.delivery.dateTitle')} subtitle={t('customer.delivery.dateSubtitle')} data={data} error={error}>
  {data&&d&&<>
   {answered&&data.dateResponse==='CONFIRMED'&&<div className="customer-link-done"><CheckCircleFilled/><div><strong>{t('customer.delivery.dateDone')}</strong><span>{t('customer.links.confirmedOn',{date:when(data.dateRespondedAtUtc)})}</span></div></div>}
   {answered&&data.dateResponse==='RESCHEDULE'&&<div className="customer-link-done is-warning"><CheckCircleFilled/><div><strong>{t('customer.delivery.preferredTitle')}</strong><span>{t('customer.delivery.preferredText',{date:when(data.preferredAtUtc)})}</span></div></div>}
   {data.dateResponse&&!answered&&<Alert style={{marginBottom:16}} type="info" showIcon title={t('customer.delivery.timeChanged')}/>}
   <div className="customer-date-block">
    <div className="customer-date-day"><span>{formatDate(d,{month:'short'}).toLocaleUpperCase(formatLocale())}</span><strong>{d.getDate()}</strong></div>
    <div className="customer-date-text"><strong>{formatDate(d,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</strong><span><ClockCircleOutlined/> {formatDate(d,{hour:'numeric',minute:'2-digit'})}</span>
     {data.address&&<span><EnvironmentOutlined/> {data.address}</span>}<span><InboxOutlined/> {t('customer.delivery.packages',{count:data.packageCount})}</span></div>
   </div>
   {data.isClosed?<Alert type="success" showIcon title={t('customer.delivery.completed')}/>:changing?<div className="customer-date-change">
     <label><span>{t('customer.delivery.preferredLabel')}</span><Input type="datetime-local" size="large" value={time} min={toLocal(new Date().toISOString())} onChange={e=>setTime(e.target.value)}/></label>
     <div className="customer-link-actions"><Button size="large" onClick={()=>setChanging(false)}>{t('common.back')}</Button><Button type="primary" size="large" loading={busy} disabled={!time} onClick={()=>void save(false,new Date(time).toISOString())}>{t('customer.delivery.sendPreferred')}</Button></div>
    </div>
    :<div className="customer-link-actions">
     <Button size="large" icon={<EditOutlined/>} onClick={()=>{setTime(toLocal(data.preferredAtUtc??data.scheduledAtUtc));setChanging(true)}}>{t('customer.delivery.askAnother')}</Button>
     <Button type="primary" size="large" loading={busy} disabled={answered&&data.dateResponse==='CONFIRMED'} onClick={()=>void save(true)}>{answered&&data.dateResponse==='CONFIRMED'?t('customer.links.confirmed'):t('customer.delivery.yesWorks')}</Button>
    </div>}
  </>}
 </Shell>
}

/* ---------------- 2. share the delivery location ---------------- */
export function CustomerDeliveryLocationPage({token}:{token:string}){
 const {t}=useT()
 const {data,setData,error}=usePublicNote(token)
 // `fresh` = captured on this visit; only a fresh position is sent, so saving an address alone keeps the saved pin.
 const [pos,setPos]=useState<{latitude:number;longitude:number;accuracy?:number;fresh?:boolean}>(),[address,setAddress]=useState(''),[notes,setNotes]=useState(''),[busy,setBusy]=useState<'gps'|'save'|null>(null)
 useEffect(()=>{if(!data)return;setAddress(data.address??'');setNotes(data.locationNotes??'');setPos(p=>p?.fresh?p:data.latitude!=null&&data.longitude!=null?{latitude:data.latitude,longitude:data.longitude}:undefined)},[data])
 const locate=()=>{
  if(!navigator.geolocation){message.error(t('customer.links.locationUnsupported'));return}
  setBusy('gps')
  navigator.geolocation.getCurrentPosition(p=>{setPos({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,fresh:true});setBusy(null)},
   ()=>{setBusy(null);message.error(t('customer.links.allowLocation'))},{enableHighAccuracy:true,timeout:20000})
 }
 const changed=Boolean(data)&&(address.trim()!==(data?.address??'')||notes.trim()!==(data?.locationNotes??'')||Boolean(pos?.fresh))
 const save=async()=>{
  setBusy('save')
  try{
   const sent=await publicDeliveryApi.shareLocation(token,{...(pos?.fresh?{latitude:pos.latitude,longitude:pos.longitude}:{}),address:address.trim()||undefined,notes:notes.trim()||undefined})
   setPos(p=>p&&{...p,fresh:false});setData(sent);message.success(pos?.fresh?t('customer.delivery.savedBoth'):t('customer.delivery.savedAddress'))
  }catch(e){fail(e,t('customer.delivery.saveFailed'))}finally{setBusy(null)}
 }
 const box=pos?[pos.longitude-.004,pos.latitude-.0025,pos.longitude+.004,pos.latitude+.0025].map(x=>x.toFixed(6)).join(','):''
 const savedGps=data?.latitude!=null&&data?.longitude!=null
 return <Shell variant="location" purpose="LOCATION" icon={<EnvironmentOutlined/>} title={t('customer.delivery.locationTitle')} subtitle={t('customer.delivery.locationSubtitle')} data={data} error={error}>
  {data&&<>
   {data.locationSharedAtUtc&&<div className="customer-link-done"><CheckCircleFilled/><div><strong>{t('customer.delivery.locationDone')}</strong><span>{t(data.isClosed?'customer.delivery.lastUpdated':'customer.delivery.lastUpdatedCanChange',{date:when(data.locationSharedAtUtc)})}</span></div></div>}
   <section className="customer-current-address">
    <small>{t('customer.delivery.currentAddress')}</small>
    <strong className="packing-preserve-lines">{data.address||t('customer.delivery.noAddress')}</strong>
    {data.locationNotes&&<span>{t('customer.delivery.directions',{notes:data.locationNotes})}</span>}
    <span className={savedGps?'is-set':''}><AimOutlined/> {savedGps?<>{t('customer.delivery.gpsSaved')} · <a href={mapsUrl(data.address??'',data.latitude,data.longitude)} target="_blank" rel="noopener noreferrer">{t('customer.links.openMaps')}</a></>:t('customer.delivery.noGps')}</span>
   </section>
   {!data.isClosed&&<>
    <h2 className="customer-section-title">{t('customer.delivery.updateTitle')}</h2>
    <label className="customer-field"><span>{t('customer.delivery.addressLabel')}</span><Input.TextArea rows={3} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)} placeholder={t('customer.delivery.addressPlaceholder')}/></label>
    <label className="customer-field"><span>{t('customer.delivery.directionsLabel')} <em>{t('customer.links.optional')}</em></span><Input.TextArea rows={2} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder={t('customer.links.directionsPlaceholder')}/></label>
    <div className="customer-field"><span>{t('customer.delivery.exactLocation')} <em>{t('customer.delivery.exactHint')}</em></span>
     <Button block size="large" className="customer-gps-button" icon={<AimOutlined/>} loading={busy==='gps'} onClick={locate}>{pos?.fresh?t('customer.links.useLocationAgain'):savedGps?t('customer.delivery.replaceLocation'):t('customer.links.useLocation')}</Button>
    </div>
   </>}
   {pos&&<>
    <div className="customer-map"><iframe title={t('customer.links.mapTitle')} loading="lazy" src={'https://www.openstreetmap.org/export/embed.html?bbox='+box+'&layer=mapnik&marker='+pos.latitude.toFixed(6)+','+pos.longitude.toFixed(6)}/></div>
    <p className="customer-map-caption">{pos.fresh?t('customer.delivery.newNotSaved')+' · ':''}{pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}{pos.accuracy?' · '+t('customer.links.accuracy',{meters:Math.round(pos.accuracy)}):''}</p>
   </>}
   {!data.isClosed&&<Button block type="primary" size="large" loading={busy==='save'} disabled={!changed||(!address.trim()&&!pos?.fresh)} onClick={()=>void save()}>{pos?.fresh?t('customer.delivery.saveBoth'):t('customer.delivery.saveAddress')}</Button>}
  </>}
 </Shell>
}
