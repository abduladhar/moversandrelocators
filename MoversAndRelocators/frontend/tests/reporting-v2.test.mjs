// Report Engine V2 engine checks. Run: node tests/reporting-v2.test.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'

import path from 'node:path'
import {pathToFileURL} from 'node:url'
import ts from 'typescript'

// Transpile the engine (plain TypeScript, no framework) into ES modules under node_modules/.cache so
// package imports (html2canvas, jspdf) still resolve from the project.
const src=new URL('../src/reportingV2/engine/',import.meta.url)
const cache=new URL('../node_modules/.cache/',import.meta.url)
fs.mkdirSync(cache,{recursive:true})
const out=fs.mkdtempSync(path.join(cache.pathname.replace(/^\/([A-Za-z]:)/,'$1'),'rev2-'))
for(const f of fs.readdirSync(src).filter(f=>f.endsWith('.ts'))){
 const code=ts.transpileModule(fs.readFileSync(new URL(f,src),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022,verbatimModuleSyntax:false}}).outputText
 fs.writeFileSync(path.join(out,f.replace(/\.ts$/,'.mjs')),code.replace(/from '(\.\/[\w-]+)'/g,"from '$1.mjs'"))
}
const load=f=>import(pathToFileURL(path.join(out,f+'.mjs')).href)
const {safeEval}=await load('safe-eval')
const {ReportExpressionService}=await load('expression')
const {createEngine,renderDocument}=await load('engine')
const {starterLayout,professionalLayout}=await load('autoLayout')
const {layoutProblem}=await load('validate')
const {qrMatrix}=await load('qr-encoder')
const {code128Modules}=await load('barcode-encoder')

let checks=0
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name)}
const expr=new ReportExpressionService()

await check('Expressions evaluate paths, arithmetic, helpers and methods',()=>{
 expr.bind={a:{b:2},items:[{amount:1.5},{amount:2.25}],name:'box',flag:false,when:'2026-03-04'}
 assert.equal(expr.interpolate('{{a.b*3+1}}'),'7')
 assert.equal(expr.interpolate('{{MONEY(SUM(items.amount))}}'),'3.75')
 assert.equal(expr.interpolate("{{IF(flag,'Y','N')}} {{UPPER(name)}} {{name.toUpperCase()}} {{items.length}}"),'N BOX BOX 2')
 assert.equal(expr.interpolate('{{DATE(when)}}'),'04-03-2026')
 assert.equal(expr.interpolate('{{flag ? 1 : (a.b >= 2 && "yes")}}'),'yes')
 assert.equal(expr.interpolate('{{WORDS(1250.5,"USD")}}'),'One thousand two hundred fifty and 50/100 only')
 assert.equal(expr.interpolate('{{missing.deep.path}}'),'')
})

await check('Expressions cannot reach globals, prototypes or constructors',()=>{
 globalThis.__pwned=false
 const attacks=['constructor.constructor("globalThis.__pwned=true")()','a.constructor','a.__proto__','name.constructor.constructor("return 1")()','globalThis','window','fetch("/x")','this','SUM.call(null)','items.map(SUM)','toString.constructor','name["constructor"]','eval("1")','(()=>1)()','a.b=5','new Date()']
 expr.bind={a:{b:2},name:'x',items:[1]}
 for(const a of attacks){const v=expr.evalExpr(a);assert.ok(v==='⚠'||v===undefined,a+' -> '+String(v))}
 assert.equal(globalThis.__pwned,false)
 assert.equal(expr.bind.a.b,2)
 assert.throws(()=>safeEval('x.constructor',{x:{}},new Set()))
})

await check('Rendered text, table cells and attributes are escaped',()=>{
 const {html}=renderDocument({mode:'fixed',pages:[{id:'p',size:'A4',w:794,h:1123,margin:38,elements:[
  {id:'t',type:'text',x:0,y:0,w:100,h:20,text:'{{name}}',fontFamily:'Arial',fontSize:12,color:'#111',bg:'transparent',align:'left',valign:'center'},
  {id:'i',type:'image',x:0,y:30,w:100,h:20,src:'{{img}}'},
  {id:'g',type:'table',x:0,y:60,w:300,h:60,dataPath:'rows',showHeader:true,columns:[{header:'<b>H</b>',expr:'{{v}}',width:100,align:'left'}],fontFamily:'Arial',fontSize:10,color:'#111',gridColor:'#ddd',headerBg:'#000',headerColor:'#fff'}
 ]}],bands:{}},{name:'<script>alert(1)</script>',img:'x" onerror="alert(1)',rows:[{v:'<img src=x onerror=alert(1)>'}]})
 assert.ok(!html.includes('<script>alert'));assert.ok(html.includes('&lt;script&gt;'))
 assert.ok(!html.includes('" onerror="'));assert.ok(!html.includes('<img src=x'))
 assert.ok(html.includes('&lt;b&gt;H&lt;/b&gt;'))
})

await check('Layout validation rejects style injection and bad image sources',()=>{
 const base=()=>({mode:'fixed',pages:[{id:'p',elements:[{id:'e',type:'text',color:'#111',text:'<anything>',src:''}]}]})
 assert.equal(layoutProblem(base()),'')
 const bad1=base();bad1.pages[0].elements[0].color='red" onclick="x';assert.notEqual(layoutProblem(bad1),'')
 const bad2=base();bad2.pages[0].elements[0].color='red;background:url(x)';assert.notEqual(layoutProblem(bad2),'')
 const bad3=base();bad3.pages[0].elements[0].src='javascript:alert(1)';assert.notEqual(layoutProblem(bad3),'')
 const ok=base();ok.pages[0].elements[0].src='data:image/png;base64,iVBORw0KGgo=';assert.equal(layoutProblem(ok),'')
 assert.notEqual(layoutProblem({mode:'script',pages:[{}]}),'')
})

await check('System starter layouts validate and render real-shaped data',()=>{
 const invoice={company:{name:'Acme Movers'},title:'INV-1',generatedAt:'2026-01-02T10:00:00Z',number:'INV-1',paid:0,balance:120,details:{type:'INVOICE',partyName:'Jane',currency:'USD',date:'2026-01-02',amount:120,lines:Array.from({length:80},(_,i)=>({description:'Line '+i,quantity:1,unitPrice:1.5,amount:1.5}))}}
 const layout=starterLayout('INVOICE',invoice)
 assert.equal(layoutProblem(JSON.parse(JSON.stringify(layout))),'')
 assert.equal(layout.bands.detail.dataPath,'details.lines')
 const {sheets,html}=renderDocument(layout,invoice)
 assert.ok(sheets.length>=2,'80 lines flow over several pages')
 assert.ok(html.includes('Acme Movers')&&html.includes('Line 79')&&html.includes('Page 1 of '+sheets.length))
 const labels=starterLayout('BOX_LABELS',{company:{name:'Acme'},pickup:{pickupNumber:'P-1',customerName:'Jane',address:'1 Road'},packages:[{trackingNumber:'TRK1',boxIndex:1,boxCount:2,items:[{itemName:'Books',quantity:2}]},{trackingNumber:'TRK2',boxIndex:2,boxCount:2,items:[]}]})
 assert.equal(layoutProblem(JSON.parse(JSON.stringify(labels))),'')
 const r=renderDocument(labels,{company:{name:'Acme'},pickup:{pickupNumber:'P-1',customerName:'Jane',address:'1 Road'},packages:[{trackingNumber:'TRK1',boxIndex:1,boxCount:2,items:[{itemName:'Books',quantity:2}]},{trackingNumber:'TRK2',boxIndex:2,boxCount:2,items:[]}]})
 assert.equal(r.sheets.length,2,'one label per package')
 assert.ok(r.sheets[0].html.includes('1 / 2')&&r.sheets[1].html.includes('TRK2')&&r.sheets[0].html.includes('Books'))
})

await check('Professional defaults: letterhead, totals and words for every document type',()=>{
 const logo='data:image/png;base64,iVBORw0KGgo='
 const company={name:'Acme Movers LLC',logo,address:'12 Harbour Road\nDubai',phone:'+971 4 000',email:'hi@acme.test',taxId:'TRN 9',footerNote:'Thank you for your business'}
 const invoice={company,title:'INV-7',generatedAt:'2026-05-01T09:00:00Z',number:'INV-7',paid:20,balance:100,details:{type:'INVOICE',partyName:'Jane Doe',partyCode:'C-1',address:'5 Palm St',currency:'USD',date:'2026-05-01',dueDate:'2026-05-31',amount:120,lines:[{description:'Packing',sourceLabel:'P-1',quantity:2,unitPrice:60,amount:120}]}}
 const layout=professionalLayout('INVOICE',invoice)
 assert.equal(layoutProblem(JSON.parse(JSON.stringify(layout))),'')
 const {html}=renderDocument(layout,invoice)
 assert.ok(html.includes('src="'+logo+'"'),'logo from the letterhead')
 assert.ok(html.includes('12 Harbour Road<br>Dubai'),'multi-line address')
 assert.ok(html.includes('+971 4 000  ·  hi@acme.test'),'contact line skips missing values')
 assert.ok(html.includes('Jane Doe')&&html.includes('120.00 USD')&&html.includes('One hundred twenty only'))
 assert.ok(html.includes('Thank you for your business'),'letterhead footer note replaces the system note')
 const logoEl=layout.bands.pageHeader.elements.find(e=>e.type==='image'),addr=layout.bands.pageHeader.elements.find(e=>e.text==='{{company.address}}')
 assert.ok(logoEl.x===0&&addr.align==='right'&&addr.x>=730/2&&addr.x+addr.w===730,'logo top-left, address top-right')
 for(const t of ['BILL','RECEIPT','PAYMENT','CREDIT_MEMO','DEBIT_MEMO','QUOTATION','PICKUP_RECEIPT','PACKING_LIST','WAREHOUSE_RECEIPT','JOB_MANIFEST','COST_REPORT','ACCOUNTING_0','ACCOUNTING_7','BOX_LABELS','PACKING_LABELS','PACKING_SHEET','PACKING_RECEIPT','DELIVERY_NOTE','DELIVERY_RECEIPT']){
  const l=professionalLayout(t,{company,title:t,rows:[{code:'1000',name:'Cash',debit:1}],filters:{from:'2026-01-01',to:'2026-02-01',currency:'BASE'}})
  assert.equal(layoutProblem(JSON.parse(JSON.stringify(l))),'',t)
  assert.ok(renderDocument(l,{company,title:t,packages:[{trackingNumber:'X',items:[]}]}).sheets.length>=1,t)
 }
})

await check('Packing job labels: one label per box with the job reference and contents',()=>{
 const data={company:{name:'Acme'},job:{jobNumber:'PK-1',customerName:'Jane',address:'1 Road'},boxes:[{trackingNumber:'PKB-1',boxIndex:1,boxCount:2,boxTypeName:'Medium',roomName:'Kitchen',isFragile:true,items:[{itemName:'Plates',quantity:12}]},{trackingNumber:'PKB-2',boxIndex:2,boxCount:2,boxTypeName:'Medium',items:[]}]}
 const layout=professionalLayout('PACKING_LABELS',data)
 assert.equal(layout.repeatPath,'boxes')
 const r=renderDocument(layout,data)
 assert.equal(r.sheets.length,2)
 assert.ok(r.sheets[0].html.includes('Job PK-1')&&r.sheets[0].html.includes('Jane')&&r.sheets[0].html.includes('Plates')&&r.sheets[0].html.includes('FRAGILE')&&r.sheets[1].html.includes('PKB-2'))
 const sheet=renderDocument(professionalLayout('PACKING_SHEET',data),{...data,boxCount:2,itemCount:12,crew:[{employeeName:'Pat'}]}).html
 assert.ok(sheet.includes('Plates × 12')&&sheet.includes('Kitchen')&&sheet.includes('Pat'))
})

await check('Batch layouts repeat per record and flow summary sections follow the rows',()=>{
 const e=createEngine()
 e.state.loadSample('batchinvoice')
 e.state.datasets.batch=[{Invoice:{InvoiceNo:'A'}},{Invoice:{InvoiceNo:'B'}},{Invoice:{InvoiceNo:'C'}}]
 assert.equal(e.exporter.exportSheets().length,3)
 const f=createEngine()
 f.state.loadSample('statement')
 f.state.addSummaryBand()
 const pages=f.state.paginateFlow(f.state.datasets.flow.Rows)
 assert.ok(pages.length>1)
 assert.deepEqual(pages.flatMap(p=>p.summaries),['summary1'])
 assert.equal(pages.reduce((n,p)=>n+p.rows.length,0),f.state.datasets.flow.Rows.length)
})

await check('QR and Code 128 encoders produce valid symbols',()=>{
 const m=qrMatrix('https://example.com/track/TRK-0001','M')
 assert.equal(m.length,29);assert.ok(m[0][0]&&m[0][6]&&!m[0][7])
 const w=code128Modules('TRK-0001')
 assert.equal(w.reduce((a,b)=>a+b,0)%11,2,'Code 128 symbols are 11 modules per char + 2-module stop bar')
})

await check('Delivery note: one customer, their packages and the captured signature above its line',()=>{
 const sig='data:image/png;base64,iVBORw0KGgo='
 const data={company:{name:'Acme'},delivery:{deliveryNumber:'DL-1',scheduledAtUtc:'2026-10-11T09:00:00Z',vehicleName:'VAN-1 · Van',driverName:'Dee Driver'},
  note:{noteNumber:'DN-1',customerName:'Jane',contactName:'Neighbour',address:'1 Road',phone:'123',isSigned:true,signerName:'Jane',signedAtUtc:'2026-10-11T10:00:00Z',signaturePng:sig,remarks:'All good'},
  items:[{index:1,trackingNumber:'WBX-1',description:'Sofa',contents:'Sofa',statusLabel:'Delivered',receivedBy:'Jane'}],itemCount:1}
 const layout=professionalLayout('DELIVERY_NOTE',data)
 assert.equal(layoutProblem(JSON.parse(JSON.stringify(layout))),'')
 const {html}=renderDocument(layout,data)
 assert.ok(html.includes('src="'+sig+'"'),'captured signature is printed')
 assert.ok(html.includes('WBX-1')&&html.includes('Delivered · Jane')&&html.includes('Attn: Neighbour')&&html.includes('Customer signature'))
})

fs.rmSync(out,{recursive:true,force:true})
console.log(checks+' checks passed')
