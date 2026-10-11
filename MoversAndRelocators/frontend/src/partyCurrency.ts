import type {CurrencyChoices} from './currency'
import type {Choices} from './billingApi'
export type Details={currency:string;amount:number;baseAmount?:number|null;partyCode?:string;direction?:string;type?:string;date?:string;fx?:{date:string}}
export function partyEquivalent(d:Details,choices:Choices|undefined,currencies:CurrencyChoices|undefined){
 const customer=d.direction==='INCOME'||d.type==='INVOICE'||d.type==='RECEIPT'
 const label=customer?'Customer':'Vendor'
 if(!currencies||!choices)return {label,warning:'Currency details are loading.'}
 const party=(customer?choices.customers:choices.vendors).find(p=>p.code===d.partyCode)
 if(!party)return {label,warning:'No linked '+label.toLowerCase()+' master.'}
 const currency=party.currency||currencies.settings.defaultCurrency
 if(currency===d.currency)return {label,currency,amount:d.amount,decimals:currencies.currencies.find(c=>c.code===currency)?.decimalPlaces??2}
 if(d.baseAmount==null)return {label,currency,warning:'No saved base amount for conversion.'}
 const date=d.date||d.fx?.date
 if(!date)return {label,currency,warning:'No transaction date for conversion.'}
 const rate=currencies.rates.filter(r=>r.currency===currency&&r.date<=date).sort((a,b)=>b.date.localeCompare(a.date))[0]
 const perUnit=currency===currencies.baseCurrency?1:rate&&(!rate.endDate||rate.endDate>=date)?rate.usdPerUnit:undefined
 if(!perUnit)return {label,currency,warning:'No '+currency+' exchange rate valid on '+date+'.'}
 const decimals=currencies.currencies.find(c=>c.code===currency)?.decimalPlaces??2
 return {label,currency,amount:Number((d.baseAmount/perUnit).toFixed(decimals)),decimals,date}
}

