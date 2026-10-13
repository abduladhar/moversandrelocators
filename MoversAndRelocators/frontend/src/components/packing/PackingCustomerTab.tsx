import {useState,type ReactNode} from 'react'
import { useMessageTemplate, type MessageValues } from '../../messageTemplates'
import { ShareChannels } from '../ShareChannels'
import {Alert,Button,Card,Input,Modal,Popconfirm,Select,Tag,Tooltip,message} from 'antd'
import {CalendarOutlined,CopyOutlined,EnvironmentOutlined,InboxOutlined,LinkOutlined,MailOutlined,StopOutlined,WhatsAppOutlined} from '@ant-design/icons'
import {mapsUrl,packingApi,type PackingDetail,type PackingLinkPurpose} from '../../packingApi'
import {formatDateTime,useT} from '../../i18n'

const when=(v:string|null)=>v?formatDateTime(v):''
type Act=(f:()=>Promise<PackingDetail>,done?:string)=>Promise<PackingDetail|undefined>

// Texts: packing.customer.links.<PURPOSE>.title / .help / .subject, translated at render.
const LINKS:Record<PackingLinkPurpose,{icon:ReactNode}>={
 SCHEDULE:{icon:<CalendarOutlined/>},
 LOCATION:{icon:<EnvironmentOutlined/>},
 ITEMS:{icon:<InboxOutlined/>}
}

/**
 * Customer confirmations for a packing job. Each purpose (date, location, packed items) has its own link and page,
 * so they can be sent at the right moment and revoked independently.
 */
export function PackingCustomerTab({detail,act}:{detail:PackingDetail;act:Act}){
 const j=detail.job,c=detail.customer,{t}=useT()
 const [shared,setShared]=useState<{purpose:PackingLinkPurpose;url:string}>()
 // One template per purpose, so the date, location and item requests can be worded differently.
 const templates:Record<PackingLinkPurpose,(v:MessageValues)=>string>={
  SCHEDULE:useMessageTemplate('PACKING_DATE').message,
  LOCATION:useMessageTemplate('PACKING_LOCATION').message,
  ITEMS:useMessageTemplate('PACKING_ITEMS').message,
 }
 const text=shared?templates[shared.purpose]({customer:j.customerName,reference:j.jobNumber,link:shared.url}):''
 const gps=c.latitude!=null&&c.longitude!=null

 const items=!detail.boxes.length?<Tag>{t('packing.customer.nothingPacked')}</Tag>:!c.itemsResponse?<Tag color="gold">{t('packing.customer.awaiting')}</Tag>
  :!c.itemsResponseCurrent?<Tag color="orange">{t('packing.customer.outdated')}</Tag>:c.itemsResponse==='CONFIRMED'?<Tag color="green">{t('packing.customer.confirmed')}</Tag>:<Tag color="red">{t('packing.customer.correctionsRequested')}</Tag>

 return <div className="packing-customer-grid">
  <LinkCard purpose="SCHEDULE" detail={detail} act={act} onShared={setShared} status={c.scheduleConfirmedAtUtc?<Tag color="green">{t('packing.customer.confirmed')}</Tag>:<Tag color="gold">{t('packing.customer.awaiting')}</Tag>}>
   <Fact label={t('packing.customer.packingDate')} value={when(j.scheduledAtUtc)}/>
   <Fact label={t('packing.customer.confirmedByCustomer')} value={c.scheduleConfirmedAtUtc?when(c.scheduleConfirmedAtUtc):t('packing.customer.notYet')}/>
  </LinkCard>

  <LinkCard purpose="LOCATION" detail={detail} act={act} onShared={setShared} status={c.locationSharedAtUtc?<Tag color="green">{t('packing.customer.shared')}</Tag>:<Tag color="gold">{t('packing.customer.awaiting')}</Tag>}>
   <Fact label={t('common.address')} value={j.address}/>
   <Fact label={t('packing.customer.gps')} value={gps?<a href={mapsUrl(j.address,c.latitude,c.longitude)} target="_blank" rel="noopener noreferrer">{c.latitude!.toFixed(6)}, {c.longitude!.toFixed(6)}</a>:t('packing.customer.notShared')}/>
   {c.locationNotes&&<Fact label={t('packing.customer.directions')} value={c.locationNotes}/>}
   {c.locationSharedAtUtc&&<Fact label={t('packing.customer.shared')} value={when(c.locationSharedAtUtc)}/>}
   <Button size="small" icon={<EnvironmentOutlined/>} onClick={()=>window.open(mapsUrl(j.address,c.latitude,c.longitude),'_blank','noopener')}>{t('packing.customer.openInMaps')}</Button>
  </LinkCard>

  <LinkCard purpose="ITEMS" detail={detail} act={act} onShared={setShared} status={items} disabled={!detail.boxes.length?t('packing.customer.packFirst'):undefined}>
   <Fact label={t('packing.packingList')} value={t('packing.boxCount',{count:detail.boxes.length})+' · '+t('packing.customer.itemCount',{count:detail.boxes.reduce((n,b)=>n+b.items.reduce((m,i)=>m+i.quantity,0),0)})}/>
   {c.itemsResponse&&<Alert showIcon type={!c.itemsResponseCurrent?'info':c.itemsResponse==='CONFIRMED'?'success':'warning'}
    title={c.itemsResponse==='CONFIRMED'?t('packing.customer.confirmedBy',{name:c.itemsResponderName??''}):t('packing.customer.correctionsFrom',{name:c.itemsResponderName??''})}
    description={<><div>{when(c.itemsRespondedAtUtc)}{!c.itemsResponseCurrent&&' · '+t('packing.customer.changedSince')}</div>{c.itemsResponseNotes&&<div className="packing-preserve-lines">{c.itemsResponseNotes}</div>}</>}/>}
  </LinkCard>

  <Modal centered open={Boolean(shared)} title={shared?t('packing.customer.shareTitle',{title:t('packing.customer.links.'+shared.purpose+'.title')}):''} footer={null} onCancel={()=>setShared(undefined)}>
   <Input.TextArea value={shared?.url} readOnly autoSize={{minRows:2,maxRows:3}}/>
   <p className="packing-customer-meta" style={{marginTop:10}}>{t('packing.customer.shownOnce')}</p>
   <ShareChannels url={shared?.url??''} phone={j.phone} email={j.email} text={text} subject={shared?t('packing.customer.links.'+shared.purpose+'.subject')+' · '+j.jobNumber:undefined}/>
  </Modal>
 </div>
}

function Fact({label,value}:{label:string;value:ReactNode}){return <div className="packing-customer-fact"><dt>{label}</dt><dd>{value}</dd></div>}

/** One confirmation: its status and details, and the controls for its own link. */
function LinkCard({purpose,detail,act,onShared,status,disabled,children}:{purpose:PackingLinkPurpose;detail:PackingDetail;act:Act;onShared:(v:{purpose:PackingLinkPurpose;url:string})=>void;status:ReactNode;disabled?:string;children:ReactNode}){
 const {t}=useT()
 const meta={icon:LINKS[purpose].icon,title:t('packing.customer.links.'+purpose+'.title'),help:t('packing.customer.links.'+purpose+'.help')},j=detail.job,link=detail.customer.links.find(l=>l.purpose===purpose)
 const [days,setDays]=useState(7),[busy,setBusy]=useState(false)
 const blocked=disabled??(j.status==='CANCELLED'?t('packing.customer.reopenFirst'):purpose!=='ITEMS'&&j.status==='COMPLETED'?t('packing.customer.jobCompleted'):undefined)
 const create=async()=>{
  setBusy(true)
  try{const r=await packingApi.createLink(j.id,purpose,days);onShared({purpose,url:r.url});await act(()=>packingApi.get(j.id))}
  catch(e){message.error(e instanceof Error?e.message:t('packing.customer.linkFailed'))}finally{setBusy(false)}
 }
 return <Card className={'packing-link-card packing-link-'+purpose.toLowerCase()} title={<span className="packing-link-title"><span className="packing-link-icon">{meta.icon}</span>{meta.title}</span>} extra={status}>
  <p className="packing-customer-meta">{meta.help}</p>
  <dl className="packing-customer-facts">{children}</dl>
  <div className="packing-link-footer">
   <div className="packing-link-state"><LinkOutlined/>{link?<span>{t('packing.customer.activeUntil')} <strong>{when(link.expiresAtUtc)}</strong></span>:<span>{t('packing.customer.noLink')}</span>}</div>
   <div className="packing-link-actions">
    <Select size="small" value={days} onChange={setDays} style={{width:110}} options={[1,3,7,14,30].map(d=>({value:d,label:t('packing.customer.days',{count:d})}))} aria-label={t('packing.customer.linkValidity')}/>
    <Tooltip title={blocked}><Button size="small" type="primary" icon={<LinkOutlined/>} loading={busy} disabled={Boolean(blocked)} onClick={()=>void create()}>{link?t('packing.customer.newLink'):t('packing.customer.createLink')}</Button></Tooltip>
    {link&&<Popconfirm title={t('packing.customer.revokeTitle',{title:meta.title})} description={t('packing.customer.revokeHelp')} okText={t('packing.customer.revoke')} cancelText={t('common.cancel')} okButtonProps={{danger:true}} onConfirm={()=>void act(()=>packingApi.revokeLink(j.id,purpose),t('packing.customer.revoked'))}><Button size="small" danger icon={<StopOutlined/>}>{t('packing.customer.revoke')}</Button></Popconfirm>}
   </div>
  </div>
 </Card>
}
