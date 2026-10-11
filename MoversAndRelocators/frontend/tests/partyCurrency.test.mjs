import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source=fs.readFileSync(new URL('../src/partyCurrency.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const scope={exports:{}}
vm.runInNewContext(output,scope)
const convert=scope.exports.partyEquivalent
const choices={customers:[{code:'C',currency:'EUR'},{code:'D'}],vendors:[{code:'V',currency:'JPY'}]}
const currencies={baseCurrency:'USD',settings:{defaultCurrency:'AED'},currencies:[{code:'EUR',decimalPlaces:2},{code:'JPY',decimalPlaces:0},{code:'AED',decimalPlaces:2}],rates:[{currency:'EUR',date:'2026-01-01',usdPerUnit:2},{currency:'EUR',date:'2026-02-01',endDate:'2026-02-28',usdPerUnit:4},{currency:'JPY',date:'2026-01-01',usdPerUnit:0.01}]}
const transaction={type:'INVOICE',partyCode:'C',currency:'AED',amount:100,baseAmount:50,date:'2026-01-15'}
assert.equal(convert(transaction,choices,currencies).amount,25)
assert.equal(convert({...transaction,date:'2026-02-28'},choices,currencies).amount,12.5)
assert.match(convert({...transaction,date:'2026-03-01'},choices,currencies).warning,/No EUR exchange rate/)
assert.equal(convert({...transaction,currency:'EUR',baseAmount:null},choices,currencies).amount,100)
assert.equal(convert({...transaction,partyCode:'D'},choices,currencies).amount,100)
assert.equal(convert({...transaction,type:'PAYMENT',partyCode:'V',baseAmount:1.234},choices,currencies).amount,123)
assert.match(convert({...transaction,partyCode:undefined},choices,currencies).warning,/No linked customer/)
assert.match(convert({...transaction,baseAmount:null},choices,currencies).warning,/No saved base amount/)
assert.equal(convert(transaction,choices,{...currencies,baseCurrency:'EUR',rates:[]}).amount,50)
console.log('9 customer/vendor currency conversion checks passed.')
