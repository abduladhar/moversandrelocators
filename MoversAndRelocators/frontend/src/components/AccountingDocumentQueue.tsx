import type {Memo} from './MemoPanel'
import {request} from '../api'
import {useEffect,useState} from 'react'
import {Alert,Button,Space,Tag,message} from 'antd'
import {billingApi,type Doc,type Row,type Voucher} from '../billingApi'
import {formatMoney} from '../currency'
import {DataGrid} from './DataGrid'

export function AccountingDocumentQueue(){
 const [rows,setRows]=useState<(Row<Doc|Voucher|Memo>&{kind:string})[]>([]),[loading,setLoading]=useState(false),[posting,setPosting]=useState<string>()
 const load=async()=>{setLoading(true);try{const [documents,vouchers,memos]=await Promise.all([billingApi.documents(),billingApi.vouchers(),request<Row<Memo>[]>('/api/billing/memos')]);setRows([...documents.map(r=>({...r,kind:'documents'})),...vouchers.map(r=>({...r,kind:'vouchers'})),...memos.map(r=>({...r,kind:'memos'}))].filter(r=>!r.journalId&&!r.details.voided))}catch(e){message.error(e instanceof Error?e.message:'Unable to load drafts')}finally{setLoading(false)}}
 useEffect(()=>{void load()},[])
 const post=async(r:typeof rows[number])=>{if(posting)return;setPosting(r.id);try{await billingApi.save(r.kind+'/'+r.id+'/post',{id:r.id,version:r.version});message.success('Posted to accounting');await load()}catch(e){message.error(e instanceof Error?e.message:'Posting failed')}finally{setPosting(undefined)}}
 return <section style={{marginBottom:32}}>
 <h2>Invoices, bills, memos & vouchers awaiting posting</h2>
 <Alert type="info" showIcon title="Review drafts before posting" description="Invoices debit receivables and credit income. Bills debit expenses and credit payables. Receipts debit cash/bank and credit receivables; vendor payments debit payables and credit cash/bank."/>
 <Space style={{margin:'16px 0'}}><Button loading={loading} onClick={()=>void load()}>Refresh documents</Button><Tag>{rows.length} pending</Tag></Space>
 <DataGrid rowKey="id" loading={loading} dataSource={rows} scroll={{x:800}} columns={[
 {title:'Number',dataIndex:'number'},{title:'Type',dataIndex:['details','type']},{title:'Customer / vendor',dataIndex:['details','partyName']},{title:'Date',dataIndex:['details','date']},{title:'Amount',align:'right',render:(_,r)=>formatMoney(r.details.amount,r.details.currency)},
 {title:'Actions',key:'actions',render:(_,r)=><Button type="primary" loading={posting===r.id} disabled={!!posting} onClick={()=>void post(r)}>Post to accounting</Button>}
 ]}/>
 </section>
}

