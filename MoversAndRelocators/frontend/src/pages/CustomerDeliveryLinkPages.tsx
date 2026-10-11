import {useEffect,useState,type ReactNode} from 'react'
import {Alert,Button,Input,Spin,message} from 'antd'
import {AimOutlined,CalendarOutlined,CheckCircleFilled,ClockCircleOutlined,EditOutlined,EnvironmentOutlined,InboxOutlined} from '@ant-design/icons'
import {publicDeliveryApi,type DeliveryLinkPurpose,type PublicDeliveryNote} from '../deliveryApi'
import {mapsUrl} from '../packingApi'

/** ISO (UTC) ⇄ the value of a datetime-local input in the customer's own time zone. */
const toLocal=(iso:string)=>{const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
const when=(v:string|null)=>v?new Date(v).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):''
const fail=(e:unknown,fallback:string)=>message.error(e instanceof Error?e.message:fallback)

function usePublicNote(token:string){
 const [data,setData]=useState<PublicDeliveryNote>(),[error,setError]=useState('')
 useEffect(()=>{publicDeliveryApi.get(token).then(setData).catch(e=>setError(e instanceof Error?e.message:'This link is not available.'))},[token])
 return {data,setData,error}
}

/** Common frame of the delivery link pages (same look as the packing customer pages). */
function Shell({variant,purpose,icon,title,subtitle,data,error,children}:{variant:string;purpose:DeliveryLinkPurpose;icon:ReactNode;title:string;subtitle:string;data?:PublicDeliveryNote;error:string;children?:ReactNode}){
 return <main className={'customer-link customer-link--'+variant}>
  <div className="customer-link-card">
   <header className="customer-link-hero">
    <span className="customer-link-icon">{icon}</span>
    <div><small>{data?.tenantName??' '}</small><h1>{title}</h1><p>{subtitle}</p></div>
   </header>
   {error?<div className="customer-link-body"><Alert type="warning" showIcon title="This link is not available" description={error}/></div>
    :!data?<div className="customer-link-body customer-link-loading"><Spin aria-label="Loading"/></div>
    :data.purpose!==purpose?<div className="customer-link-body"><Alert type="warning" showIcon title="This link is for a different request. Please open the link exactly as you received it."/></div>
    :<>
     <div className="customer-link-ref"><div><span>Customer</span><strong>{data.customerName}</strong></div><div><span>Delivery reference</span><strong>{data.noteNumber}</strong></div></div>
     <div className="customer-link-body">{data.status==='CANCELLED'?<Alert type="info" showIcon title="This delivery was cancelled. We will contact you to arrange a new one."/>:children}</div>
     <footer className="customer-link-footer">{data.tenantName} · link valid until {when(data.expiresAtUtc)}</footer>
    </>}
  </div>
 </main>
}

/* ---------------- 1. confirm the delivery date ---------------- */
export function CustomerDeliveryDatePage({token}:{token:string}){
 const {data,setData,error}=usePublicNote(token)
 const [changing,setChanging]=useState(false),[time,setTime]=useState(''),[busy,setBusy]=useState(false)
 const save=async(confirmed:boolean,preferredAtUtc?:string)=>{
  setBusy(true)
  try{setData(await publicDeliveryApi.respondDate(token,{confirmed,preferredAtUtc}));setChanging(false);message.success(confirmed?'Delivery date confirmed':'Your preferred time has been sent')}
  catch(e){fail(e,'Unable to send your answer.')}finally{setBusy(false)}
 }
 const d=data?new Date(data.scheduledAtUtc):null,answered=data?.dateResponseCurrent
 return <Shell variant="date" purpose="SCHEDULE" icon={<CalendarOutlined/>} title="Confirm your delivery date" subtitle="Let us know the delivery time suits you, or tell us a better time." data={data} error={error}>
  {data&&d&&<>
   {answered&&data.dateResponse==='CONFIRMED'&&<div className="customer-link-done"><CheckCircleFilled/><div><strong>Thank you, your delivery date is confirmed</strong><span>Confirmed on {when(data.dateRespondedAtUtc)}</span></div></div>}
   {answered&&data.dateResponse==='RESCHEDULE'&&<div className="customer-link-done is-warning"><CheckCircleFilled/><div><strong>We received your preferred time</strong><span>You asked for {when(data.preferredAtUtc)}. We will contact you to confirm the new delivery time.</span></div></div>}
   {data.dateResponse&&!answered&&<Alert style={{marginBottom:16}} type="info" showIcon title="The delivery time has changed since your last answer. Please confirm the new time."/>}
   <div className="customer-date-block">
    <div className="customer-date-day"><span>{d.toLocaleDateString([],{month:'short'}).toUpperCase()}</span><strong>{d.getDate()}</strong></div>
    <div className="customer-date-text"><strong>{d.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</strong><span><ClockCircleOutlined/> {d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span>
     {data.address&&<span><EnvironmentOutlined/> {data.address}</span>}<span><InboxOutlined/> {data.packageCount} {data.packageCount===1?'package':'packages'}</span></div>
   </div>
   {data.isClosed?<Alert type="success" showIcon title="This delivery is completed."/>:changing?<div className="customer-date-change">
     <label><span>Your preferred date and time</span><Input type="datetime-local" size="large" value={time} min={toLocal(new Date().toISOString())} onChange={e=>setTime(e.target.value)}/></label>
     <div className="customer-link-actions"><Button size="large" onClick={()=>setChanging(false)}>Back</Button><Button type="primary" size="large" loading={busy} disabled={!time} onClick={()=>void save(false,new Date(time).toISOString())}>Send preferred time</Button></div>
    </div>
    :<div className="customer-link-actions">
     <Button size="large" icon={<EditOutlined/>} onClick={()=>{setTime(toLocal(data.preferredAtUtc??data.scheduledAtUtc));setChanging(true)}}>Ask for another time</Button>
     <Button type="primary" size="large" loading={busy} disabled={answered&&data.dateResponse==='CONFIRMED'} onClick={()=>void save(true)}>{answered&&data.dateResponse==='CONFIRMED'?'Confirmed':'Yes, this time works'}</Button>
    </div>}
  </>}
 </Shell>
}

/* ---------------- 2. share the delivery location ---------------- */
export function CustomerDeliveryLocationPage({token}:{token:string}){
 const {data,setData,error}=usePublicNote(token)
 // `fresh` = captured on this visit; only a fresh position is sent, so saving an address alone keeps the saved pin.
 const [pos,setPos]=useState<{latitude:number;longitude:number;accuracy?:number;fresh?:boolean}>(),[address,setAddress]=useState(''),[notes,setNotes]=useState(''),[busy,setBusy]=useState<'gps'|'save'|null>(null)
 useEffect(()=>{if(!data)return;setAddress(data.address??'');setNotes(data.locationNotes??'');setPos(p=>p?.fresh?p:data.latitude!=null&&data.longitude!=null?{latitude:data.latitude,longitude:data.longitude}:undefined)},[data])
 const locate=()=>{
  if(!navigator.geolocation){message.error('Location is not available on this device.');return}
  setBusy('gps')
  navigator.geolocation.getCurrentPosition(p=>{setPos({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,fresh:true});setBusy(null)},
   ()=>{setBusy(null);message.error('Please allow location access in your browser and try again.')},{enableHighAccuracy:true,timeout:20000})
 }
 const changed=Boolean(data)&&(address.trim()!==(data?.address??'')||notes.trim()!==(data?.locationNotes??'')||Boolean(pos?.fresh))
 const save=async()=>{
  setBusy('save')
  try{
   const sent=await publicDeliveryApi.shareLocation(token,{...(pos?.fresh?{latitude:pos.latitude,longitude:pos.longitude}:{}),address:address.trim()||undefined,notes:notes.trim()||undefined})
   setPos(p=>p&&{...p,fresh:false});setData(sent);message.success(pos?.fresh?'Address and location saved':'Address saved')
  }catch(e){fail(e,'Unable to save your address.')}finally{setBusy(null)}
 }
 const box=pos?[pos.longitude-.004,pos.latitude-.0025,pos.longitude+.004,pos.latitude+.0025].map(x=>x.toFixed(6)).join(','):''
 const savedGps=data?.latitude!=null&&data?.longitude!=null
 return <Shell variant="location" purpose="LOCATION" icon={<EnvironmentOutlined/>} title="Your delivery address" subtitle="Check the address we have, correct it if needed, and share your location to help our driver find you." data={data} error={error}>
  {data&&<>
   {data.locationSharedAtUtc&&<div className="customer-link-done"><CheckCircleFilled/><div><strong>Thank you, your details are saved</strong><span>Last updated {when(data.locationSharedAtUtc)}{data.isClosed?'':'. You can change them below.'}</span></div></div>}
   <section className="customer-current-address">
    <small>Current delivery address</small>
    <strong className="packing-preserve-lines">{data.address||'No address on file yet'}</strong>
    {data.locationNotes&&<span>Directions: {data.locationNotes}</span>}
    <span className={savedGps?'is-set':''}><AimOutlined/> {savedGps?<>GPS location saved · <a href={mapsUrl(data.address??'',data.latitude,data.longitude)} target="_blank" rel="noopener noreferrer">Open in Google Maps</a></>:'No GPS location shared yet'}</span>
   </section>
   {!data.isClosed&&<>
    <h2 className="customer-section-title">Update your delivery address</h2>
    <label className="customer-field"><span>Delivery address</span><Input.TextArea rows={3} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Building, flat / villa number, street, area, city"/></label>
    <label className="customer-field"><span>Directions for the driver <em>(optional)</em></span><Input.TextArea rows={2} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Landmark, gate number, parking, floor…"/></label>
    <div className="customer-field"><span>Exact location <em>(optional, best done at the address)</em></span>
     <Button block size="large" className="customer-gps-button" icon={<AimOutlined/>} loading={busy==='gps'} onClick={locate}>{pos?.fresh?'Use my current location again':savedGps?'Replace with my current location':'Use my current location'}</Button>
    </div>
   </>}
   {pos&&<>
    <div className="customer-map"><iframe title="Your location" loading="lazy" src={'https://www.openstreetmap.org/export/embed.html?bbox='+box+'&layer=mapnik&marker='+pos.latitude.toFixed(6)+','+pos.longitude.toFixed(6)}/></div>
    <p className="customer-map-caption">{pos.fresh?'New location (not saved yet) · ':''}{pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}{pos.accuracy?' · accurate to about '+Math.round(pos.accuracy)+' m':''}</p>
   </>}
   {!data.isClosed&&<Button block type="primary" size="large" loading={busy==='save'} disabled={!changed||(!address.trim()&&!pos?.fresh)} onClick={()=>void save()}>{pos?.fresh?'Save address and location':'Save address'}</Button>}
  </>}
 </Shell>
}
