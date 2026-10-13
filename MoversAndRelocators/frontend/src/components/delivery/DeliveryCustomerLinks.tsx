import {useState,type ReactNode} from 'react'
import { useMessageTemplate, type MessageValues } from '../../messageTemplates'
import { ShareChannels } from '../ShareChannels'
import {Alert,Button,Card,Input,Modal,Popconfirm,Select,Tag,Tooltip,message} from 'antd'
import {CalendarOutlined,CopyOutlined,EnvironmentOutlined,LinkOutlined,StopOutlined} from '@ant-design/icons'
import {deliveryApi,type DeliveryDetail,type DeliveryLinkPurpose,type DeliveryNote} from '../../deliveryApi'
import {mapsUrl} from '../../packingApi'
import {formatDateTime,useT} from '../../i18n'

const when=(v:string|null)=>v?formatDateTime(v):''
type Act=(f:()=>Promise<DeliveryDetail>,done?:string)=>Promise<DeliveryDetail|undefined>

/** Each link's title and help are texts under delivery.links.<key>. */
const LINKS:Record<DeliveryLinkPurpose,{key:string;icon:ReactNode}>={
 SCHEDULE:{key:'schedule',icon:<CalendarOutlined/>},
 LOCATION:{key:'location',icon:<EnvironmentOutlined/>}
}

/** Tags for the note header: the customer's answer on the date, and whether GPS was shared. */
export function CustomerStatusTags({note}:{note:DeliveryNote}){
 const {t}=useT()
 const c=note.customer
 const date=!c.dateResponse?null:!c.dateResponseCurrent?<Tag color="orange">{t('delivery.links.tag.dateOutdated')}</Tag>
  :c.dateResponse==='CONFIRMED'?<Tag color="green">{t('delivery.links.tag.dateConfirmed')}</Tag>:<Tag color="red">{t('delivery.links.tag.asksFor',{date:when(c.preferredAtUtc)})}</Tag>
 return <>{date}{c.latitude!=null?<Tag color="green" icon={<EnvironmentOutlined/>}>{t('delivery.links.tag.gpsShared')}</Tag>:c.locationSharedAtUtc?<Tag color="green" icon={<EnvironmentOutlined/>}>{t('delivery.links.tag.addressUpdated')}</Tag>:null}</>
}

/** Per-customer links on a delivery note: confirm the delivery date, and share the delivery location. */
export function DeliveryCustomerLinks({detail,note,open,onClose,act}:{detail:DeliveryDetail;note:DeliveryNote|null;open:boolean;onClose:()=>void;act:Act}){
 const {t}=useT()
 const [shared,setShared]=useState<{purpose:DeliveryLinkPurpose;url:string}>()
 // Declared before the early return below: hooks cannot run conditionally.
 const templates:Record<DeliveryLinkPurpose,(v:MessageValues)=>string>={
  SCHEDULE:useMessageTemplate('DELIVERY_DATE').message,
  LOCATION:useMessageTemplate('DELIVERY_LOCATION').message,
 }
 if(!note)return null
 const c=note.customer,j=detail.job
 const gps=c.latitude!=null&&c.longitude!=null
 const text=shared?templates[shared.purpose]({customer:note.customerName,reference:note.noteNumber,link:shared.url}):''
 const sharedTitle=shared?t('delivery.links.'+LINKS[shared.purpose].key+'.title'):undefined
 const blocked=j.status==='COMPLETED'?t('delivery.links.blockedCompleted'):j.status==='CANCELLED'?t('delivery.links.blockedCancelled'):note.isSigned?t('delivery.links.blockedSigned'):undefined
 const dateStatus=!c.dateResponse?<Tag color="gold">{t('delivery.links.awaiting')}</Tag>:!c.dateResponseCurrent?<Tag color="orange">{t('delivery.links.outdated')}</Tag>:c.dateResponse==='CONFIRMED'?<Tag color="green">{t('delivery.links.confirmed')}</Tag>:<Tag color="red">{t('delivery.links.otherTime')}</Tag>
 const answer=c.dateResponse==='CONFIRMED'?t('delivery.links.confirmed'):t('delivery.links.tag.asksFor',{date:when(c.preferredAtUtc)})
 return <Modal centered width={980} open={open} title={t('delivery.links.title',{customer:note.customerName,note:note.noteNumber})} footer={null} onCancel={onClose} destroyOnHidden>
  <div className="packing-customer-grid">
   <LinkCard purpose="SCHEDULE" detail={detail} note={note} act={act} blocked={blocked} onShared={setShared} status={dateStatus}>
    <Fact label={t('delivery.links.deliveryDate')} value={when(j.scheduledAtUtc)}/>
    <Fact label={t('delivery.links.customerAnswer')} value={!c.dateResponse?t('delivery.links.notYet'):t('delivery.links.answerAt',{answer,date:when(c.dateRespondedAtUtc)})}/>
    {c.dateResponse==='RESCHEDULE'&&c.dateResponseCurrent&&<Alert type="warning" showIcon title={t('delivery.links.rescheduleTitle')} description={t('delivery.links.rescheduleDescription')}/>}
    {c.dateResponse&&!c.dateResponseCurrent&&<Alert type="info" showIcon title={t('delivery.links.timeChanged')}/>}
   </LinkCard>
   <LinkCard purpose="LOCATION" detail={detail} note={note} act={act} blocked={blocked} onShared={setShared} status={c.locationSharedAtUtc?<Tag color="green">{t('delivery.links.shared')}</Tag>:<Tag color="gold">{t('delivery.links.awaiting')}</Tag>}>
    <Fact label={t('delivery.links.deliveryAddress')} value={note.address??'—'}/>
    <Fact label={t('delivery.links.gpsLocation')} value={gps?<a href={mapsUrl(note.address??'',c.latitude,c.longitude)} target="_blank" rel="noopener noreferrer">{c.latitude!.toFixed(6)}, {c.longitude!.toFixed(6)}</a>:t('delivery.links.notShared')}/>
    {c.locationNotes&&<Fact label={t('delivery.links.directions')} value={c.locationNotes}/>}
    {c.locationSharedAtUtc&&<Fact label={t('delivery.links.shared')} value={when(c.locationSharedAtUtc)}/>}
    <Button size="small" icon={<EnvironmentOutlined/>} disabled={!note.address&&!gps} onClick={()=>window.open(mapsUrl(note.address??'',c.latitude,c.longitude),'_blank','noopener')}>{t('delivery.links.openInMaps')}</Button>
   </LinkCard>
  </div>
  <Modal centered open={Boolean(shared)} title={sharedTitle?t('delivery.links.shareTitle',{title:sharedTitle}):''} footer={null} onCancel={()=>setShared(undefined)}>
   <Input.TextArea value={shared?.url} readOnly autoSize={{minRows:2,maxRows:3}}/>
   <p className="packing-customer-meta" style={{marginTop:10}}>{t('delivery.links.shownOnce')}</p>
   <ShareChannels url={shared?.url??''} phone={note.phone} text={text} subject={sharedTitle}>
    <Button icon={<CopyOutlined/>} onClick={()=>{void navigator.clipboard.writeText(text);message.success(t('delivery.links.messageCopied'))}}>{t('delivery.links.copyMessage')}</Button>
   </ShareChannels>
  </Modal>
 </Modal>
}

function Fact({label,value}:{label:string;value:ReactNode}){return <div className="packing-customer-fact"><dt>{label}</dt><dd>{value}</dd></div>}

/** One link: its status and details, and the controls to create, renew or revoke it. */
function LinkCard({purpose,detail,note,act,blocked,onShared,status,children}:{purpose:DeliveryLinkPurpose;detail:DeliveryDetail;note:DeliveryNote;act:Act;blocked?:string;onShared:(v:{purpose:DeliveryLinkPurpose;url:string})=>void;status:ReactNode;children:ReactNode}){
 const {t}=useT()
 const meta=LINKS[purpose],j=detail.job,link=note.customer.links.find(l=>l.purpose===purpose)
 const title=t('delivery.links.'+meta.key+'.title')
 const [days,setDays]=useState(7),[busy,setBusy]=useState(false)
 const create=async()=>{
  setBusy(true)
  try{const r=await deliveryApi.createLink(j.id,note.id,purpose,days);onShared({purpose,url:r.url});await act(()=>deliveryApi.get(j.id))}
  catch(e){message.error(e instanceof Error?e.message:t('delivery.links.createFailed'))}finally{setBusy(false)}
 }
 return <Card className={'packing-link-card packing-link-'+(purpose==='SCHEDULE'?'schedule':'location')} title={<span className="packing-link-title"><span className="packing-link-icon">{meta.icon}</span>{title}</span>} extra={status}>
  <p className="packing-customer-meta">{t('delivery.links.'+meta.key+'.help')}</p>
  <dl className="packing-customer-facts">{children}</dl>
  <div className="packing-link-footer">
   <div className="packing-link-state"><LinkOutlined/>{link?<span>{t('delivery.links.activeUntilPrefix')} <strong>{when(link.expiresAtUtc)}</strong></span>:<span>{t('delivery.links.noLink')}</span>}</div>
   <div className="packing-link-actions">
    <Select size="small" value={days} onChange={setDays} style={{width:110}} options={[1,3,7,14,30].map(d=>({value:d,label:t('delivery.links.days',{count:d})}))} aria-label={t('delivery.links.validity')}/>
    <Tooltip title={blocked}><Button size="small" type="primary" icon={<LinkOutlined/>} loading={busy} disabled={Boolean(blocked)} onClick={()=>void create()}>{link?t('delivery.links.newLink'):t('delivery.links.createLink')}</Button></Tooltip>
    {link&&<Popconfirm title={t('delivery.links.revokeTitle',{title})} description={t('delivery.links.revokeDescription')} okText={t('delivery.links.revoke')} cancelText={t('common.cancel')} okButtonProps={{danger:true}} onConfirm={()=>void act(()=>deliveryApi.revokeLink(j.id,note.id,purpose),t('delivery.links.revoked'))}><Button size="small" danger icon={<StopOutlined/>}>{t('delivery.links.revoke')}</Button></Popconfirm>}
   </div>
  </div>
 </Card>
}
