import {t} from './i18n'
import type {CurrencyChoices} from './currency'
import type {Choices} from './billingApi'
export type Details={currency:string;amount:number;baseAmount?:number|null;partyCode?:string;direction?:string;type?:string;date?:string;fx?:{date:string}}
export function partyEquivalent(d:Details,choices:Choices|undefined,currencies:CurrencyChoices|undefined){
 const customer=d.direction==='INCOME'||d.type==='INVOICE'||d.type==='RECEIPT'
 const label=customer?t('shared.party.customer'):t('shared.party.vendor')
 if(!currencies||!choices)return {label,warning:t('shared.party.currencyLoading')}
 const party=(customer?choices.customers:choices.vendors).find(p=>p.code===d.partyCode)
 if(!party)return {label,warning:t(customer?'shared.party.noCustomerMaster':'shared.party.noVendorMaster')}
 const currency=party.currency||currencies.settings.defaultCurrency
 if(currency===d.currency)return {label,currency,amount:d.amount,decimals:currencies.currencies.find(c=>c.code===currency)?.decimalPlaces??2}
 if(d.baseAmount==null)return {label,currency,warning:t('shared.party.noBaseAmount')}
 const date=d.date||d.fx?.date
 if(!date)return {label,currency,warning:t('shared.party.noTransactionDate')}
 const rate=currencies.rates.filter(r=>r.currency===currency&&r.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0]
 const perUnit=currency===currencies.baseCurrency?1:rate&&(!rate.endDate||rate.endDate>=date)?rate.usdPerUnit:undefined
 if(!perUnit)return {label,currency,warning:t('shared.party.noRate',{currency,date})}
 const decimals=currencies.currencies.find(c=>c.code===currency)?.decimalPlaces??2
 return {label,currency,amount:Number((d.baseAmount/perUnit).toFixed(decimals)),decimals,date}
}

