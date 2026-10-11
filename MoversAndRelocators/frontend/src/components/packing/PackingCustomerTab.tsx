import {useState,type ReactNode} from 'react'
import {Alert,Button,Card,Input,Modal,Popconfirm,Select,Tag,Tooltip,message} from 'antd'
import {CalendarOutlined,CopyOutlined,EnvironmentOutlined,InboxOutlined,LinkOutlined,MailOutlined,StopOutlined,WhatsAppOutlined} from '@ant-design/icons'
import {mapsUrl,packingApi,type PackingDetail,type PackingLinkPurpose} from '../../packingApi'

const when=(v:string|null)=>v?new Date(v).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):''
type Act=(f:()=>Promise<PackingDetail>,done?:string)=>Promise<PackingDetail|undefined>

const LINKS:Record<PackingLinkPurpose,{title:string;icon:ReactNode;help:string;subject:string;ask:string}>={
 SCHEDULE:{title:'Confirm packing date',icon:<CalendarOutlined/>,help:'The customer confirms the packing date and time, or picks another time that suits them.',subject:'Confirm your packing date',ask:'please confirm your packing date and time'},
 LOCATION:{title:'Share location',icon:<EnvironmentOutlined/>,help:'The customer shares the exact GPS location of the packing address, with directions for the crew.',subject:'Share your packing location',ask:'please share your location for packing'},
 ITEMS:{title:'Confirm packed items',icon:<InboxOutlined/>,help:'After packing, the customer reviews every box and its contents and confirms or requests corrections.',subject:'Review your packed items',ask:'please review and confirm your packed items'}
}

/**
 * Customer confirmations for a packing job. Each purpose (date, location, packed items) has its own link and page,
 * so they can be sent at the right moment and revoked independently.
 */
export function PackingCustomerTab({detail,act}:{detail:PackingDetail;act:Act}){
 const j=detail.job,c=detail.customer
 const [shared,setShared]=useState<{purpose:PackingLinkPurpose;url:string}>()
 const text=shared?'Hello '+j.customerName+', '+LINKS[shared.purpose].ask+' ('+j.jobNumber+'): '+shared.url:''
 const gps=c.latitude!=null&&c.longitude!=null

 const items=!detail.boxes.length?<Tag>Nothing packed yet</Tag>:!c.itemsResponse?<Tag color="gold">Awaiting customer</Tag>
  :!c.itemsResponseCurrent?<Tag color="orange">Outdated</Tag>:c.itemsResponse==='CONFIRMED'?<Tag color="green">Confirmed</Tag>:<Tag color="red">Corrections requested</Tag>

 return <div className="packing-customer-grid">
  <LinkCard purpose="SCHEDULE" detail={detail} act={act} onShared={setShared} status={c.scheduleConfirmedAtUtc?<Tag color="green">Confirmed</Tag>:<Tag color="gold">Awaiting customer</Tag>}>
   <Fact label="Packing date" value={when(j.scheduledAtUtc)}/>
   <Fact label="Confirmed by customer" value={c.scheduleConfirmedAtUtc?when(c.scheduleConfirmedAtUtc):'Not yet'}/>
  </LinkCard>

  <LinkCard purpose="LOCATION" detail={detail} act={act} onShared={setShared} status={c.locationSharedAtUtc?<Tag color="green">Shared</Tag>:<Tag color="gold">Awaiting customer</Tag>}>
   <Fact label="Address" value={j.address}/>
   <Fact label="GPS location" value={gps?<a href={mapsUrl(j.address,c.latitude,c.longitude)} target="_blank" rel="noopener noreferrer">{c.latitude!.toFixed(6)}, {c.longitude!.toFixed(6)}</a>:'Not shared'}/>
   {c.locationNotes&&<Fact label="Directions" value={c.locationNotes}/>}
   {c.locationSharedAtUtc&&<Fact label="Shared" value={when(c.locationSharedAtUtc)}/>}
   <Button size="small" icon={<EnvironmentOutlined/>} onClick={()=>window.open(mapsUrl(j.address,c.latitude,c.longitude),'_blank','noopener')}>Open in Maps</Button>
  </LinkCard>

  <LinkCard purpose="ITEMS" detail={detail} act={act} onShared={setShared} status={items} disabled={!detail.boxes.length?'Pack at least one box first':undefined}>
   <Fact label="Packing list" value={detail.boxes.length+' boxes · '+detail.boxes.reduce((n,b)=>n+b.items.reduce((m,i)=>m+i.quantity,0),0)+' items'}/>
   {c.itemsResponse&&<Alert showIcon type={!c.itemsResponseCurrent?'info':c.itemsResponse==='CONFIRMED'?'success':'warning'}
    title={(c.itemsResponse==='CONFIRMED'?'Confirmed by ':'Corrections from ')+c.itemsResponderName}
    description={<><div>{when(c.itemsRespondedAtUtc)}{!c.itemsResponseCurrent&&' · boxes changed since — ask the customer to review again'}</div>{c.itemsResponseNotes&&<div className="packing-preserve-lines">{c.itemsResponseNotes}</div>}</>}/>}
  </LinkCard>

  <Modal centered open={Boolean(shared)} title={shared?'Share · '+LINKS[shared.purpose].title:''} footer={null} onCancel={()=>setShared(undefined)}>
   <Input.TextArea value={shared?.url} readOnly autoSize={{minRows:2,maxRows:3}}/>
   <p className="packing-customer-meta" style={{marginTop:10}}>This link is shown only now. Creating a new one replaces it.</p>
   <div className="survey-share-actions">
    <Button className="share-whatsapp" icon={<WhatsAppOutlined/>} onClick={()=>window.open('https://wa.me/'+j.phone.replace(/\D/g,'')+'?text='+encodeURIComponent(text),'_blank','noopener')}>WhatsApp</Button>
    <Button icon={<MailOutlined/>} disabled={!j.email} onClick={()=>window.open('mailto:'+j.email+'?subject='+encodeURIComponent(LINKS[shared!.purpose].subject+' · '+j.jobNumber)+'&body='+encodeURIComponent(text))}>Email</Button>
    <Button icon={<CopyOutlined/>} onClick={()=>{void navigator.clipboard.writeText(shared?.url??'');message.success('Link copied')}}>Copy link</Button>
   </div>
  </Modal>
 </div>
}

function Fact({label,value}:{label:string;value:ReactNode}){return <div className="packing-customer-fact"><dt>{label}</dt><dd>{value}</dd></div>}

/** One confirmation: its status and details, and the controls for its own link. */
function LinkCard({purpose,detail,act,onShared,status,disabled,children}:{purpose:PackingLinkPurpose;detail:PackingDetail;act:Act;onShared:(v:{purpose:PackingLinkPurpose;url:string})=>void;status:ReactNode;disabled?:string;children:ReactNode}){
 const meta=LINKS[purpose],j=detail.job,link=detail.customer.links.find(l=>l.purpose===purpose)
 const [days,setDays]=useState(7),[busy,setBusy]=useState(false)
 const blocked=disabled??(j.status==='CANCELLED'?'Reopen the job first':purpose!=='ITEMS'&&j.status==='COMPLETED'?'The job is completed':undefined)
 const create=async()=>{
  setBusy(true)
  try{const r=await packingApi.createLink(j.id,purpose,days);onShared({purpose,url:r.url});await act(()=>packingApi.get(j.id))}
  catch(e){message.error(e instanceof Error?e.message:'Unable to create the link')}finally{setBusy(false)}
 }
 return <Card className={'packing-link-card packing-link-'+purpose.toLowerCase()} title={<span className="packing-link-title"><span className="packing-link-icon">{meta.icon}</span>{meta.title}</span>} extra={status}>
  <p className="packing-customer-meta">{meta.help}</p>
  <dl className="packing-customer-facts">{children}</dl>
  <div className="packing-link-footer">
   <div className="packing-link-state"><LinkOutlined/>{link?<span>Link active until <strong>{when(link.expiresAtUtc)}</strong></span>:<span>No link sent</span>}</div>
   <div className="packing-link-actions">
    <Select size="small" value={days} onChange={setDays} style={{width:110}} options={[1,3,7,14,30].map(d=>({value:d,label:d+(d===1?' day':' days')}))} aria-label="Link validity"/>
    <Tooltip title={blocked}><Button size="small" type="primary" icon={<LinkOutlined/>} loading={busy} disabled={Boolean(blocked)} onClick={()=>void create()}>{link?'New link':'Create link'}</Button></Tooltip>
    {link&&<Popconfirm title={'Revoke the '+meta.title.toLowerCase()+' link?'} description="The customer will no longer be able to open it." okButtonProps={{danger:true}} onConfirm={()=>void act(()=>packingApi.revokeLink(j.id,purpose),'Link revoked')}><Button size="small" danger icon={<StopOutlined/>}>Revoke</Button></Popconfirm>}
   </div>
  </div>
 </Card>
}
