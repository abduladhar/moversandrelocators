import type {Memo} from './MemoPanel'
import {request} from '../api'
import {useEffect,useState} from 'react'
import {Alert,Button,Space,Tag,message} from 'antd'
import {billingApi,type Doc,type Row,type Voucher} from '../billingApi'
import {formatMoney} from '../currency'
import {DataGrid} from './DataGrid'
import {billingLabel} from './BillingPanel'
import {useT} from '../i18n'

export function AccountingDocumentQueue(){
 const {t}=useT()
 const [rows,setRows]=useState<(Row<Doc|Voucher|Memo>&{kind:string})[]>([]),[loading,setLoading]=useState(false),[posting,setPosting]=useState<string>()
 const load=async()=>{setLoading(true);try{const [documents,vouchers,memos]=await Promise.all([billingApi.documents(),billingApi.vouchers(),request<Row<Memo>[]>('/api/billing/memos')]);setRows([...documents.map(r=>({...r,kind:'documents'})),...vouchers.map(r=>({...r,kind:'vouchers'})),...memos.map(r=>({...r,kind:'memos'}))].filter(r=>!r.journalId&&!r.details.voided))}catch(e){message.error(e instanceof Error?e.message:t('billing.queue.loadError'))}finally{setLoading(false)}}
 useEffect(()=>{void load()},[])
 const post=async(r:typeof rows[number])=>{if(posting)return;setPosting(r.id);try{await billingApi.save(r.kind+'/'+r.id+'/post',{id:r.id,version:r.version});message.success(t('billing.queue.posted'));await load()}catch(e){message.error(e instanceof Error?e.message:t('billing.queue.postError'))}finally{setPosting(undefined)}}
 return <section style={{marginBottom:32}}>
 <h2>{t('billing.queue.title')}</h2>
 <Alert type="info" showIcon title={t('billing.queue.alertTitle')} description={t('billing.queue.alertDescription')}/>
 <Space style={{margin:'16px 0'}}><Button loading={loading} onClick={()=>void load()}>{t('billing.queue.refresh')}</Button><Tag>{t('billing.queue.pending',{count:rows.length})}</Tag></Space>
 <DataGrid rowKey="id" loading={loading} dataSource={rows} scroll={{x:800}} columns={[
 {title:t('billing.columns.number'),dataIndex:'number'},{title:t('common.type'),dataIndex:['details','type'],render:(v:string)=>billingLabel(t,'docTypes',v)},{title:t('billing.columns.party'),dataIndex:['details','partyName']},{title:t('common.date'),dataIndex:['details','date']},{title:t('common.amount'),align:'right',render:(_,r)=>formatMoney(r.details.amount,r.details.currency)},
 {title:t('common.actions'),key:'actions',render:(_,r)=><Button type="primary" loading={posting===r.id} disabled={!!posting} onClick={()=>void post(r)}>{t('billing.actions.postToAccounting')}</Button>}
 ]}/>
 </section>
}
