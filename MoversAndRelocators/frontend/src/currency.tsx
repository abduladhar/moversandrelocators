import { useEffect, useRef, useState } from 'react'
import { Form, Input, InputNumber, Select, Alert } from 'antd'
import type { FormInstance } from 'antd'
import { request } from './api'
export type Currency = {code:string;name:string;decimalPlaces:number;isActive:boolean}
export type Fx = {currency:string;usdPerUnit:number;date:string;decimalPlaces:number;baseCurrency?:string;baseDecimalPlaces?:number}
export type CurrencyChoices = {baseCurrency:string;baseCurrencyLocked:boolean;settings:{defaultCurrency:string;baseCurrency:string};currencies:Currency[];rates:{currency:string;date:string;endDate?:string;usdPerUnit:number;isSample?:boolean}[]}
export const currencyApi={
 choices:()=>request<CurrencyChoices>('/api/currencies'),
 save:(path:string,value:unknown)=>request('/api/currencies'+path,{method:'POST',body:JSON.stringify(value)}),
 rate:(currency:string,date:string)=>request<Fx>('/api/currencies/rate?currency='+encodeURIComponent(currency)+'&date='+date)
}
export const localDate=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
export function formatMoney(amount:number|null|undefined,currency:string,digits?:number){
 if(amount==null)return 'Rate not recorded'
 return new Intl.NumberFormat(undefined,{style:'currency',currency,currencyDisplay:'code',...(digits===undefined?{}:{minimumFractionDigits:digits,maximumFractionDigits:digits})}).format(amount)
}
export function useCurrencies(){
 const [data,setData]=useState<CurrencyChoices>(),[error,setError]=useState('')
 const reload=async()=>{try{setData(await currencyApi.choices());setError('')}catch(e){setError(e instanceof Error?e.message:'Unable to load currencies')}}
 useEffect(()=>{void reload()},[])
 return {data,error,reload}
}
export function CurrencySelect({value,onChange,allowClear=false}:{value?:string;onChange?:(value:string)=>void;allowClear?:boolean}){
 const {data}=useCurrencies()
 return <Select showSearch allowClear={allowClear} optionFilterProp="label" value={value} onChange={onChange} options={data?.currencies.filter(x=>x.isActive||x.code===value).map(x=>({value:x.code,label:x.code+' · '+x.name}))}/>
}
export function CurrencyFields({form,dateName='date',locked=false}:{form:FormInstance;dateName?:string;locked?:boolean}){
 const {data,error}=useCurrencies(),currency=Form.useWatch('currency',form),date=Form.useWatch(dateName,form)
 const [rateError,setRateError]=useState(''),first=useRef(true)
 const transactionRate=Form.useWatch('exchangeRate',form)
 const effectiveDate=(date||localDate()).slice(0,10)
 const defaultCurrency=data?.settings.defaultCurrency
 const defaultRate=data?.rates.filter(r=>r.currency===defaultCurrency&&r.date<=effectiveDate).sort((a,b)=>b.date.localeCompare(a.date))[0]
 const defaultPerBase=defaultCurrency===data?.baseCurrency?1:defaultRate&&(!defaultRate.endDate||defaultRate.endDate>=effectiveDate)?defaultRate.usdPerUnit:undefined
 const defaultEquivalent=currency===defaultCurrency?1:defaultPerBase&&transactionRate?transactionRate/defaultPerBase:undefined
 useEffect(()=>{if(data&&!form.getFieldValue('currency'))form.setFieldValue('currency',data.settings.defaultCurrency)},[data,form])
 useEffect(()=>{
  if(!currency||locked)return
  if(first.current){first.current=false;if(form.getFieldValue("exchangeRate"))return}
  let active=true
  form.setFieldValue('exchangeRate',undefined)
  currencyApi.rate(currency,(date||localDate()).slice(0,10)).then(fx=>{if(active){form.setFieldValue('exchangeRate',fx.usdPerUnit);setRateError('')}}).catch(e=>{if(active)setRateError(e.message)})
  return()=>{active=false}
 },[currency,date,locked,form])
 return <div className="currency-fields">
 <Form.Item label="Default currency"><Input readOnly value={defaultCurrency||''}/></Form.Item>
 <Form.Item name="currency" label="Transaction currency" rules={[{required:true}]}><Select disabled={locked} showSearch optionFilterProp="label" options={data?.currencies.filter(c=>c.isActive||c.code===currency).map(c=>({value:c.code,label:c.code+' · '+c.name}))}/></Form.Item>
 <Form.Item name="exchangeRate" hidden rules={[{required:true,message:'A valid exchange rate is required.'}]}><InputNumber/></Form.Item>
 <Form.Item className="amount-field" label={'Exchange rate · 1 '+(currency||'transaction unit')+' = '+(defaultCurrency||'…')} extra="Default currency per transaction currency unit. Filled automatically for the transaction date.">
 <InputNumber aria-label="Transaction to default currency exchange rate" value={defaultEquivalent==null?null:Number(defaultEquivalent.toFixed(12))} disabled={locked||!defaultPerBase||currency===defaultCurrency||currency===data?.baseCurrency} controls={false} min={0.000000000001} max={1000000} precision={12} style={{width:'100%'}} onChange={value=>form.setFieldValue('exchangeRate',value!=null&&defaultPerBase?Number((value*defaultPerBase).toFixed(12)):undefined)}/>
 </Form.Item>
 {(error||rateError||!defaultPerBase)&&<Alert type="warning" title={error||rateError||'No default-currency rate for this date.'} description="Set a valid rate on Currency Exchange Rates to calculate the conversion."/>}
 </div>
}







