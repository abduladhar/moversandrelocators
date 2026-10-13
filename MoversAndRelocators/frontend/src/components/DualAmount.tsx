import {partyEquivalent,type Details} from '../partyCurrency'
import {Tooltip} from 'antd'
import {formatMoney,type CurrencyChoices} from '../currency'
import type {Choices} from '../billingApi'
import {formatLocale,useT} from '../i18n'
export function PartyAmount({details,choices,currencies,amount}:{details:Details;choices?:Choices;currencies?:CurrencyChoices;amount?:number}){
 const {t,language}=useT()
 const p=partyEquivalent(details,choices,currencies)
 const equivalent=p.amount==null?undefined:amount==null?p.amount:details.amount===0?0:Number((p.amount*amount/details.amount).toFixed(p.decimals))
 const date=details.date||details.fx?.date
 const party=p.label.toLocaleLowerCase(formatLocale(language))
 return <Tooltip title={p.warning||(date?t('billing.dualAmount.tooltip',{party,date}):t('billing.dualAmount.tooltipNoDate',{party}))}>
 <span>{p.label}{p.currency?' · '+p.currency:''}: {p.warning?<span>{p.warning}</span>:formatMoney(equivalent,p.currency!,p.decimals)}</span>
 </Tooltip>
}
export function DualAmount({details,choices,currencies,amount}:{details:Details;choices?:Choices;currencies?:CurrencyChoices;amount?:number}){
 return <div style={{textAlign:'end'}}><div>{formatMoney(amount??details.amount,details.currency)}</div><small><PartyAmount details={details} choices={choices} currencies={currencies} amount={amount}/></small></div>
}
