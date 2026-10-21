import { serverMessage } from './i18n'
import {request} from './api'
import {apiUrl} from './apiBase'
import {listQuery,type ListParams,type Paged} from './hooks/useServerList'

export type PackingStatus='PLANNED'|'IN_PROGRESS'|'COMPLETED'|'CANCELLED'
export type PackingJob={serialNo:number;id:string;jobNumber:string;status:PackingStatus;pickupId:string|null;pickupNumber:string|null;quotationId:string|null;quotationNumber:string|null;salesLeadId:string|null;leadNumber:string|null;customerName:string;phone:string;email:string|null;address:string;scheduledAtUtc:string;notes:string|null;startedAtUtc:string|null;completedAtUtc:string|null;createdAtUtc:string;boxCount:number;labelsPending:number;scheduleConfirmedAtUtc:string|null}
export type PackingBoxItem={itemName:string;quantity:number;notes:string|null;householdItemId:string|null}
export type PackingBox={serialNo:number;id:string;boxTypeId:string;boxTypeName:string;trackingNumber:string;roomName:string|null;isFragile:boolean;notes:string|null;items:PackingBoxItem[];labelPrintedAtUtc:string|null;labelPrintCount:number;customMaterials:boolean;materials:{materialId:string;materialName:string;unit:string;quantity:number}[]}
export type PackingMaterialUse={materialId:string;materialName:string;unit:string;quantity:number;unitCost:number;totalCost:number;isBoxRecipe:boolean}
export type PackingTransaction={serialNo:number;id:string;transactionNumber:string;type:'INCOME'|'EXPENSE';category:string;amount:number;paymentMethod:string;notes:string|null;createdAtUtc:string;currency:string|null;baseAmount:number|null;paidByEmployeeId?:string|null;paidByName?:string|null}
export type PackingAccounting={baseCurrency:string;materialCost:number;materialPosted:boolean;materialJournalReference:string|null;incomeBase:number;expenseBase:number;totals:{currency:string;income:number;expense:number}[]}
/** Customer confirmation state; itemsResponseCurrent is false when boxes changed after the customer responded. */
export type PackingLinkPurpose='SCHEDULE'|'LOCATION'|'ITEMS'
export type PackingCustomer={links:{purpose:PackingLinkPurpose;expiresAtUtc:string;createdAtUtc:string}[];scheduleConfirmedAtUtc:string|null;latitude:number|null;longitude:number|null;locationNotes:string|null;locationSharedAtUtc:string|null;itemsResponse:'CONFIRMED'|'CORRECTIONS'|null;itemsResponderName:string|null;itemsResponseNotes:string|null;itemsRespondedAtUtc:string|null;itemsResponseCurrent:boolean}
export type PackingDetail={job:PackingJob;crew:{employeeId:string;employeeName:string;role:string}[];boxes:PackingBox[];materials:PackingMaterialUse[];transactions:PackingTransaction[];accounting:PackingAccounting;customer:PackingCustomer}
export type PublicPackingJob={purpose:PackingLinkPurpose;tenantName:string;jobNumber:string;status:PackingStatus;customerName:string;address:string;scheduledAtUtc:string;scheduleConfirmedAtUtc:string|null;latitude:number|null;longitude:number|null;locationNotes:string|null;locationSharedAtUtc:string|null;expiresAtUtc:string;
 boxes:{trackingNumber:string;boxTypeName:string;roomName:string|null;isFragile:boolean;items:{itemName:string;quantity:number;notes:string|null}[]}[];itemsHash:string|null;itemsResponse:'CONFIRMED'|'CORRECTIONS'|null;itemsResponderName:string|null;itemsResponseNotes:string|null;itemsRespondedAtUtc:string|null;itemsResponseCurrent:boolean}
export type PackingChoice={code:string;name:string}
export type PackingMasters={boxTypes:{id:string;code:string;name:string;capacityCbm:number;recipe:{materialId:string;materialName:string;unit:string;quantity:number}[]}[];materials:{id:string;code:string;name:string;unit:string;currentUnitCost:number}[];employees:{id:string;name:string}[];crewRoles:PackingChoice[];paymentMethods:PackingChoice[];incomeCategories:PackingChoice[];expenseCategories:PackingChoice[]}
export type PackingSource={kind:'PICKUP'|'QUOTATION';id:string;number:string;customerName:string;phone:string;email:string|null;address:string;quotationId:string|null;salesLeadId:string|null}
export type SavePackingJob={customerName:string;phone:string;email?:string|null;address:string;scheduledAtUtc:string;notes?:string|null;pickupId?:string|null;quotationId?:string|null;salesLeadId?:string|null}
export type SavePackingBox={boxTypeId:string;roomName?:string|null;isFragile:boolean;notes?:string|null;items:{itemName:string;quantity:number;notes?:string|null}[];copies?:number;materials?:{materialId:string;quantity:number}[]|null}

const base='/api/packing'
const send=<T,>(url:string,method:string,body?:unknown)=>request<T>(url,{method,...(body===undefined?{}:{body:JSON.stringify(body)})})
export const packingApi={
 masters:()=>request<PackingMasters>(base+'/masters'),
 sources:()=>request<PackingSource[]>(base+'/sources'),
 list:()=>request<PackingJob[]>(base),
 /** The register's advanced search (server-side): search, sort, desc, skip, take, status, customerState. */
 search:(params:ListParams)=>request<Paged<PackingJob>>(base+'/search?'+listQuery(params)),
 get:(id:string)=>request<PackingDetail>(base+'/'+id),
 create:(v:SavePackingJob)=>send<PackingDetail>(base,'POST',v),
 update:(id:string,v:SavePackingJob)=>send<PackingDetail>(base+'/'+id,'PUT',v),
 status:(id:string,status:PackingStatus)=>send<PackingDetail>(base+'/'+id+'/status','PUT',{status}),
 crew:(id:string,crew:{employeeId:string;role:string}[])=>send<PackingDetail>(base+'/'+id+'/crew','PUT',{crew}),
 addBox:(id:string,v:SavePackingBox)=>send<PackingDetail>(base+'/'+id+'/boxes','POST',v),
 updateBox:(id:string,boxId:string,v:SavePackingBox)=>send<PackingDetail>(base+'/'+id+'/boxes/'+boxId,'PUT',v),
 deleteBox:(id:string,boxId:string)=>send<PackingDetail>(base+'/'+id+'/boxes/'+boxId,'DELETE'),
 labelsPrinted:(id:string,boxIds:string[])=>send<PackingDetail>(base+'/'+id+'/labels-printed','POST',{boxIds}),
 materials:(id:string,materials:{materialId:string;quantity:number;unitCost?:number|null}[])=>send<PackingDetail>(base+'/'+id+'/materials','PUT',{materials}),
 createLink:(id:string,purpose:PackingLinkPurpose,validDays:number)=>send<{purpose:PackingLinkPurpose;url:string;expiresAtUtc:string}>(base+'/'+id+'/links','POST',{purpose,validDays}),
 revokeLink:(id:string,purpose:PackingLinkPurpose)=>send<PackingDetail>(base+'/'+id+'/links/'+purpose,'DELETE'),
 transaction:(id:string,v:{type:'INCOME'|'EXPENSE';category:string;amount:number;paymentMethod:string;notes?:string;currency?:string;exchangeRate?:number;paidByEmployeeId?:string|null})=>send<PackingDetail>(base+'/'+id+'/transactions','POST',v)
}

export const STATUS_LABEL:Record<PackingStatus,{label:string;color:string}>={PLANNED:{label:'Planned',color:'blue'},IN_PROGRESS:{label:'Packing',color:'orange'},COMPLETED:{label:'Completed',color:'green'},CANCELLED:{label:'Cancelled',color:'default'}}

/** Customer link calls. Sent without the staff session so a signed-in browser cannot switch the tenant. */
const anonymous=async<T,>(url:string,body?:unknown):Promise<T>=>{
 const response=await fetch(apiUrl(url),body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 const data=await response.json().catch(()=>null)
 if(!response.ok)throw new Error(serverMessage(data,response.status)) // the server's message code, in the user's language
 return data as T
}
const publicBase=(token:string)=>'/api/public/packing-jobs/'+encodeURIComponent(token)
export const publicPackingApi={
 get:(token:string)=>anonymous<PublicPackingJob>(publicBase(token)),
 confirmSchedule:(token:string,v:{scheduledAtUtc:string})=>anonymous<PublicPackingJob>(publicBase(token)+'/schedule',v),
 shareLocation:(token:string,v:{latitude:number;longitude:number;address?:string;notes?:string})=>anonymous<PublicPackingJob>(publicBase(token)+'/location',v),
 respond:(token:string,v:{name:string;confirmed:boolean;notes?:string;snapshotHash:string})=>anonymous<PublicPackingJob>(publicBase(token)+'/items',v)
}
export const mapsUrl=(address:string,latitude?:number|null,longitude?:number|null)=>latitude!=null&&longitude!=null?'https://www.google.com/maps?q='+latitude+','+longitude:'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address)
