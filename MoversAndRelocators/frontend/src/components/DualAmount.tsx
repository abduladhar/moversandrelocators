import {partyEquivalent,type Details} from '../partyCurrency'
import {Tooltip} from 'antd'
import {formatMoney,type CurrencyChoices} from '../currency'
import type {Choices} from '../billingApi'
export function PartyAmount({details,choices,currencies,amount}:{details:Details;choices?:Choices;currencies?:CurrencyChoices;amount?:number}){
 const p=partyEquivalent(details,choices,currencies)
 const equivalent=p.amount==null?undefined:amount==null?p.amount:details.amount===0?0:Number((p.amount*amount/details.amount).toFixed(p.decimals))
 return <Tooltip title={p.warning||('Equivalent in the current '+p.label.toLowerCase()+' master currency; exchange rate valid on '+(details.date||details.fx?.date||'the transaction date')+'.')}>
 <span>{p.label}{p.currency?' · '+p.currency:''}: {p.warning?<span>{p.warning}</span>:formatMoney(equivalent,p.currency!,p.decimals)}</span>
 </Tooltip>
}
export function DualAmount({details,choices,currencies,amount}:{details:Details;choices?:Choices;currencies?:CurrencyChoices;amount?:number}){
 return <div style={{textAlign:'right'}}><div>{formatMoney(amount??details.amount,details.currency)}</div><small><PartyAmount details={details} choices={choices} currencies={currencies} amount={amount}/></small></div>
}

