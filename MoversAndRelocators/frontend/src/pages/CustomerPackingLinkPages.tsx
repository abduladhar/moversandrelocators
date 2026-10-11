import {useEffect,useState,type ReactNode} from 'react'
import {Alert,Button,Checkbox,Form,Input,Radio,Spin,Tag,message} from 'antd'
import {AimOutlined,CalendarOutlined,CheckCircleFilled,ClockCircleOutlined,EditOutlined,EnvironmentOutlined,InboxOutlined} from '@ant-design/icons'
import {mapsUrl,publicPackingApi,type PackingLinkPurpose,type PublicPackingJob} from '../packingApi'

/** ISO (UTC) ⇄ the value of a datetime-local input in the customer's own time zone. */
const toLocal=(iso:string)=>{const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
const when=(v:string|null)=>v?new Date(v).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):''
const fail=(e:unknown,fallback:string)=>message.error(e instanceof Error?e.message:fallback)

function usePublicJob(token:string){
 const [data,setData]=useState<PublicPackingJob>(),[error,setError]=useState('')
 useEffect(()=>{publicPackingApi.get(token).then(setData).catch(e=>setError(e instanceof Error?e.message:'This link is not available.'))},[token])
 return {data,setData,error}
}

/** Common frame of the customer link pages; `variant` gives each page its own colour and hero. */
function Shell({variant,purpose,icon,title,subtitle,data,error,children}:{variant:string;purpose:PackingLinkPurpose;icon:ReactNode;title:string;subtitle:string;data?:PublicPackingJob;error:string;children?:ReactNode}){
 return <main className={'customer-link customer-link--'+variant}>
  <div className="customer-link-card">
   <header className="customer-link-hero">
    <span className="customer-link-icon">{icon}</span>
    <div><small>{data?.tenantName??' '}</small><h1>{title}</h1><p>{subtitle}</p></div>
   </header>
   {error?<div className="customer-link-body"><Alert type="warning" showIcon title="This link is not available" description={error}/></div>
    :!data?<div className="customer-link-body customer-link-loading"><Spin aria-label="Loading"/></div>
    :data.purpose!==purpose?<div className="customer-link-body"><Alert type="warning" showIcon title="This link is for a different request. Please open the link exactly as you received it."/></div>
    :<>
     <div className="customer-link-ref"><div><span>Customer</span><strong>{data.customerName}</strong></div><div><span>Packing reference</span><strong>{data.jobNumber}</strong></div></div>
     <div className="customer-link-body">{data.status==='CANCELLED'?<Alert type="info" showIcon title="This packing job was cancelled. Please contact us if you have questions."/>:children}</div>
     <footer className="customer-link-footer">{data.tenantName} · link valid until {when(data.expiresAtUtc)}</footer>
    </>}
  </div>
 </main>
}

/* ---------------- 1. confirm the packing date ---------------- */
export function CustomerPackingDatePage({token}:{token:string}){
 const {data,setData,error}=usePublicJob(token)
 const [changing,setChanging]=useState(false),[time,setTime]=useState(''),[busy,setBusy]=useState(false)
 const save=async(iso:string)=>{
  setBusy(true)
  try{setData(await publicPackingApi.confirmSchedule(token,{scheduledAtUtc:iso}));setChanging(false);message.success('Packing date confirmed')}
  catch(e){fail(e,'Unable to confirm the date.')}finally{setBusy(false)}
 }
 const d=data?new Date(data.scheduledAtUtc):null,closed=data?.status==='COMPLETED'
 return <Shell variant="date" purpose="SCHEDULE" icon={<CalendarOutlined/>} title="Confirm your packing date" subtitle="Let us know the appointment suits you, or pick a better time." data={data} error={error}>
  {data&&d&&<>
   {data.scheduleConfirmedAtUtc&&<div className="customer-link-done"><CheckCircleFilled/><div><strong>Thank you, your packing date is confirmed</strong><span>Confirmed on {when(data.scheduleConfirmedAtUtc)}</span></div></div>}
   <div className="customer-date-block">
    <div className="customer-date-day"><span>{d.toLocaleDateString([],{month:'short'}).toUpperCase()}</span><strong>{d.getDate()}</strong></div>
    <div className="customer-date-text"><strong>{d.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</strong><span><ClockCircleOutlined/> {d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}</span><span><EnvironmentOutlined/> {data.address}</span></div>
   </div>
   {closed?<Alert type="success" showIcon title="Packing is completed."/>:changing?<div className="customer-date-change">
     <label><span>Choose another date and time</span><Input type="datetime-local" size="large" value={time} min={toLocal(new Date().toISOString())} onChange={e=>setTime(e.target.value)}/></label>
     <div className="customer-link-actions"><Button size="large" onClick={()=>setChanging(false)}>Back</Button><Button type="primary" size="large" loading={busy} disabled={!time} onClick={()=>void save(new Date(time).toISOString())}>Confirm new date</Button></div>
    </div>
    :<div className="customer-link-actions">
     <Button size="large" icon={<EditOutlined/>} onClick={()=>{setTime(toLocal(data.scheduledAtUtc));setChanging(true)}}>Choose another time</Button>
     <Button type="primary" size="large" loading={busy} disabled={Boolean(data.scheduleConfirmedAtUtc)} onClick={()=>void save(data.scheduledAtUtc)}>{data.scheduleConfirmedAtUtc?'Confirmed':'Yes, this date works'}</Button>
    </div>}
  </>}
 </Shell>
}

/* ---------------- 2. share the packing location ---------------- */
export function CustomerPackingLocationPage({token}:{token:string}){
 const {data,setData,error}=usePublicJob(token)
 const [pos,setPos]=useState<{latitude:number;longitude:number;accuracy?:number}>(),[address,setAddress]=useState(''),[notes,setNotes]=useState(''),[busy,setBusy]=useState<'gps'|'save'|null>(null)
 useEffect(()=>{if(!data)return;setAddress(data.address);setNotes(data.locationNotes??'');if(data.latitude!=null&&data.longitude!=null)setPos(p=>p??{latitude:data.latitude!,longitude:data.longitude!})},[data])
 const locate=()=>{
  if(!navigator.geolocation){message.error('Location is not available on this device.');return}
  setBusy('gps')
  navigator.geolocation.getCurrentPosition(p=>{setPos({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy});setBusy(null)},
   ()=>{setBusy(null);message.error('Please allow location access in your browser and try again.')},{enableHighAccuracy:true,timeout:20000})
 }
 const save=async()=>{
  if(!pos)return
  setBusy('save')
  try{setData(await publicPackingApi.shareLocation(token,{latitude:pos.latitude,longitude:pos.longitude,address:address.trim()||undefined,notes:notes.trim()||undefined}));message.success('Location shared')}
  catch(e){fail(e,'Unable to share the location.')}finally{setBusy(null)}
 }
 const box=pos?[pos.longitude-.004,pos.latitude-.0025,pos.longitude+.004,pos.latitude+.0025].map(x=>x.toFixed(6)).join(','):''
 const closed=data?.status==='COMPLETED'
 return <Shell variant="location" purpose="LOCATION" icon={<EnvironmentOutlined/>} title="Share your packing location" subtitle="Help our crew find you. Please do this while you are at the packing address." data={data} error={error}>
  {data&&<>
   {data.locationSharedAtUtc&&<div className="customer-link-done"><CheckCircleFilled/><div><strong>Thank you, your location is shared</strong><span>Shared on {when(data.locationSharedAtUtc)}{closed?'':'. You can update it below.'}</span></div></div>}
   <div className={'customer-map'+(pos?'':' is-empty')}>
    {pos?<iframe title="Your location" loading="lazy" src={'https://www.openstreetmap.org/export/embed.html?bbox='+box+'&layer=mapnik&marker='+pos.latitude.toFixed(6)+','+pos.longitude.toFixed(6)}/>
     :<div><EnvironmentOutlined/><span>Your location will appear here</span></div>}
   </div>
   {pos&&<p className="customer-map-caption">{pos.latitude.toFixed(6)}, {pos.longitude.toFixed(6)}{pos.accuracy?' · accurate to about '+Math.round(pos.accuracy)+' m':''} · <a href={mapsUrl(address,pos.latitude,pos.longitude)} target="_blank" rel="noopener noreferrer">Open in Google Maps</a></p>}
   {!closed&&<>
    <Button block size="large" className="customer-gps-button" icon={<AimOutlined/>} loading={busy==='gps'} onClick={locate}>{pos?'Use my current location again':'Use my current location'}</Button>
    <label className="customer-field"><span>Packing address</span><Input.TextArea rows={2} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Building, flat / villa number, street, area"/></label>
    <label className="customer-field"><span>Directions for the crew <em>(optional)</em></span><Input.TextArea rows={2} maxLength={500} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Landmark, gate number, parking, floor…"/></label>
    <Button block type="primary" size="large" loading={busy==='save'} disabled={!pos} onClick={()=>void save()}>{data.locationSharedAtUtc?'Update my location':'Send my location'}</Button>
   </>}
  </>}
 </Shell>
}

/* ---------------- 3. confirm the packed items ---------------- */
export function CustomerPackingItemsPage({token}:{token:string}){
 const {data,setData,error}=usePublicJob(token)
 const [form]=Form.useForm(),confirmed=Form.useWatch('confirmed',form),[busy,setBusy]=useState(false)
 const respond=async(v:{name:string;confirmed:boolean;notes?:string})=>{
  if(!data?.itemsHash)return
  setBusy(true)
  try{setData(await publicPackingApi.respond(token,{name:v.name,confirmed:v.confirmed,notes:v.notes,snapshotHash:data.itemsHash}));form.resetFields();message.success('Your response has been recorded')}
  catch(e){fail(e,'Unable to save your response.')}finally{setBusy(false)}
 }
 const answered=data?.itemsResponse&&data.itemsResponseCurrent
 const count=data?.boxes.reduce((n,b)=>n+b.items.reduce((m,i)=>m+i.quantity,0),0)??0
 return <Shell variant="items" purpose="ITEMS" icon={<InboxOutlined/>} title="Confirm your packed items" subtitle="Please check every box and its contents before your goods leave." data={data} error={error}>
  {data&&<>
   <div className="customer-items-summary"><div><strong>{data.boxes.length}</strong><span>{data.boxes.length===1?'box':'boxes'}</span></div><div><strong>{count}</strong><span>{count===1?'item':'items'}</span></div><div><strong>{data.boxes.filter(b=>b.isFragile).length}</strong><span>fragile</span></div></div>
   {data.boxes.map((b,index)=><article className="customer-box" key={b.trackingNumber}>
    <header><span className="customer-box-no">{index+1}</span><div><strong>{b.trackingNumber}</strong><small>{b.boxTypeName}{b.roomName?' · '+b.roomName:''}</small></div>{b.isFragile&&<Tag color="red">Fragile</Tag>}</header>
    <ul>{b.items.length?b.items.map((i,n)=><li key={n}><span>{i.itemName}{i.notes&&<small> · {i.notes}</small>}</span><strong>× {i.quantity}</strong></li>):<li><span>No item details recorded</span></li>}</ul>
   </article>)}
   <div className="customer-items-response">
    {answered?<div className={'customer-link-done'+(data.itemsResponse==='CORRECTIONS'?' is-warning':'')}><CheckCircleFilled/><div>
      <strong>{data.itemsResponse==='CONFIRMED'?'Thank you, you confirmed this packing list':'Your corrections have been sent'}</strong>
      <span>{data.itemsResponderName} · {when(data.itemsRespondedAtUtc)}</span>{data.itemsResponseNotes&&<p className="packing-preserve-lines">{data.itemsResponseNotes}</p>}</div></div>
    :<>
     {data.itemsResponse&&<Alert style={{marginBottom:16}} type="info" showIcon title="The packing list was updated after your last response. Please review it again."/>}
     <Form form={form} layout="vertical" onFinish={v=>void respond(v)} disabled={busy} requiredMark={false}>
      <Form.Item name="confirmed" label="Is this packing list correct?" rules={[{required:true,message:'Confirm the list or request corrections.'}]}><Radio.Group className="customer-choice" options={[{value:true,label:'Yes, everything is correct'},{value:false,label:'No, corrections are needed'}]}/></Form.Item>
      <Form.Item name="notes" label={confirmed===false?'What needs to be corrected?':'Comments (optional)'} rules={confirmed===false?[{required:true,whitespace:true,message:'Describe the corrections needed.'}]:[]}><Input.TextArea rows={3} maxLength={2000} showCount/></Form.Item>
      <Form.Item name="name" label="Your full name" rules={[{required:true,whitespace:true,message:'Enter your full name.'}]}><Input size="large" maxLength={160} autoComplete="name"/></Form.Item>
      <Form.Item name="authorized" valuePropName="checked" rules={[{validator:(_,v)=>v?Promise.resolve():Promise.reject(new Error('Please confirm you are authorized to respond.'))}]}><Checkbox>I am the customer or their authorized representative and I have reviewed the boxes above.</Checkbox></Form.Item>
      <Button block type="primary" size="large" htmlType="submit" loading={busy}>Send my response</Button>
     </Form>
    </>}
   </div>
  </>}
 </Shell>
}
