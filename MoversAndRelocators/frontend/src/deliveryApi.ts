import { serverMessage, t } from './i18n'
import {request} from './api'
import {apiUrl} from './apiBase'
import type {WarehouseStock} from './warehouseApi'
import {listQuery,type ListParams,type Paged} from './hooks/useServerList'

export type DeliveryStatus='PLANNED'|'OUT_FOR_DELIVERY'|'COMPLETED'|'CANCELLED'
export type DeliveryItemStatus='LOADED'|'DELIVERED'|'RETURNED'
export type DeliveryJob={serialNo:number;id:string;deliveryNumber:string;status:DeliveryStatus;scheduledAtUtc:string;durationMinutes:number;notes:string|null;
 vehicleId:string|null;vehicleName:string|null;driverEmployeeId:string|null;driverName:string|null;startedAtUtc:string|null;completedAtUtc:string|null;isPaused:boolean;distanceKm:number|null;
 createdAtUtc:string;itemCount:number;deliveredCount:number;returnedCount:number;noteCount:number;signedCount:number;customers:string[]}
export type DeliveryItem={serialNo:number;id:string;deliveryNoteId:string;boxId:string;source:'WAREHOUSE'|'JOB';transportJobId:string|null;trackingNumber:string;description:string;contents:string;
 location:string;reference:string;status:DeliveryItemStatus;loadedAtUtc:string;loadedBy:string;statusAtUtc:string|null;receivedBy:string|null;notes:string|null}
/** One customer's delivery note on the run; the signature covers signedItems exactly as they stood when signed. */
export type DeliveryNote={id:string;noteNumber:string;customerName:string;contactName:string|null;phone:string|null;address:string|null;items:DeliveryItem[];
 isSigned:boolean;signerName:string|null;signaturePng:string|null;remarks:string|null;signedAtUtc:string|null;signedBy:string|null;signedItems:{trackingNumber:string;description:string;status:DeliveryItemStatus;receivedBy:string|null}[];collected:number;customer:DeliveryCustomer}
export type DeliveryLinkPurpose='SCHEDULE'|'LOCATION'
/** Customer responses on a note; dateResponseCurrent is false once the run was rescheduled after the customer answered. */
export type DeliveryCustomer={links:{purpose:DeliveryLinkPurpose;expiresAtUtc:string;createdAtUtc:string}[];dateResponse:'CONFIRMED'|'RESCHEDULE'|null;preferredAtUtc:string|null;dateRespondedAtUtc:string|null;dateResponseCurrent:boolean;
 latitude:number|null;longitude:number|null;locationNotes:string|null;locationSharedAtUtc:string|null}
export type PublicDeliveryNote={purpose:DeliveryLinkPurpose;tenantName:string;deliveryNumber:string;noteNumber:string;status:DeliveryStatus;isClosed:boolean;customerName:string;address:string|null;scheduledAtUtc:string;packageCount:number;
 dateResponse:'CONFIRMED'|'RESCHEDULE'|null;preferredAtUtc:string|null;dateRespondedAtUtc:string|null;dateResponseCurrent:boolean;latitude:number|null;longitude:number|null;locationNotes:string|null;locationSharedAtUtc:string|null;expiresAtUtc:string}
export type DeliveryTransaction={serialNo:number;id:string;transactionNumber:string;type:'INCOME'|'EXPENSE';category:string;amount:number;paymentMethod:string;notes:string|null;createdAtUtc:string;
 currency:string|null;baseAmount:number|null;deliveryNoteId:string|null;customerName:string|null;paidByEmployeeId?:string|null;paidByName?:string|null}
export type DeliveryDetail={job:DeliveryJob;crew:{employeeId:string;employeeName:string;role:string}[];notes:DeliveryNote[];transactions:DeliveryTransaction[];
 accounting:{baseCurrency:string;incomeBase:number;expenseBase:number;totals:{currency:string;income:number;expense:number}[]};
 clock:{activeSeconds:number;pausedSeconds:number;events:{type:'STARTED'|'PAUSED'|'RESUMED'|'COMPLETED';occurredAtUtc:string;reason:string|null;recordedBy:string}[]}}
export type DeliveryChoice={code:string;name:string}
export type DeliveryMasters={employees:{id:string;name:string}[];vehicles:{id:string;registrationNumber:string;name:string;driverName:string|null;driverPhone:string|null}[];
 crewRoles:DeliveryChoice[];paymentMethods:DeliveryChoice[];incomeCategories:DeliveryChoice[];expenseCategories:DeliveryChoice[]}
export type WarehouseShipping={shipper?:{name?:string|null;phone?:string|null;address?:string|null}|null;consignee?:{name?:string|null;phone?:string|null;address?:string|null}|null;toLocation?:string|null;dropLocation?:string|null;dropAddress?:string|null}
/** A box on a departed or arrived transport job: loadable only through its job. */
export type DeliveryJobBox={jobId:string;jobNumber:string;jobStatus:string;destination:string;box:WarehouseStock;shipping:WarehouseShipping|null}
export type DeliveryAvailable={warehouse:WarehouseStock[];jobs:DeliveryJobBox[]}
export type SaveDelivery={scheduledAtUtc:string;durationMinutes:number;notes?:string|null}

const base='/api/delivery'
const send=<T,>(url:string,method:string,body?:unknown)=>request<T>(url,{method,...(body===undefined?{}:{body:JSON.stringify(body)})})
const one=(id:string)=>base+'/'+id
export const deliveryApi={
 masters:()=>request<DeliveryMasters>(base+'/masters'),
 available:()=>request<DeliveryAvailable>(base+'/available'),
 list:()=>request<DeliveryJob[]>(base),
 /** The register's advanced search (server-side): search, sort, desc, skip, take, status, customerState. */
 search:(params:ListParams)=>request<Paged<DeliveryJob>>(base+'/search?'+listQuery(params)),
 get:(id:string)=>request<DeliveryDetail>(one(id)),
 create:(v:SaveDelivery)=>send<DeliveryDetail>(base,'POST',v),
 update:(id:string,v:SaveDelivery)=>send<DeliveryDetail>(one(id),'PUT',v),
 load:(id:string,warehouseBoxIds:string[],jobBoxes:{jobId:string;boxId:string}[])=>send<DeliveryDetail>(one(id)+'/load','POST',{warehouseBoxIds,jobBoxes}),
 unload:(id:string,itemId:string)=>send<DeliveryDetail>(one(id)+'/items/'+itemId,'DELETE'),
 itemStatus:(id:string,itemId:string,v:{status:DeliveryItemStatus;receivedBy?:string|null;notes?:string|null})=>send<DeliveryDetail>(one(id)+'/items/'+itemId+'/status','PUT',v),
 note:(id:string,noteId:string,v:{contactName?:string|null;phone?:string|null;address?:string|null})=>send<DeliveryDetail>(one(id)+'/notes/'+noteId,'PUT',v),
 sign:(id:string,noteId:string,v:{signerName:string;signaturePng:string;remarks?:string|null;deliveredItemIds:string[]})=>send<DeliveryDetail>(one(id)+'/notes/'+noteId+'/sign','POST',v),
 crew:(id:string,v:{crew:{employeeId:string;role:string}[];driverEmployeeId:string|null;vehicleId:string|null})=>send<DeliveryDetail>(one(id)+'/crew','PUT',v),
 start:(id:string,at?:string)=>send<DeliveryDetail>(one(id)+'/trip/start','POST',{at}),
 pause:(id:string,reason:string,at?:string)=>send<DeliveryDetail>(one(id)+'/trip/pause','POST',{reason,at}),
 resume:(id:string,at?:string)=>send<DeliveryDetail>(one(id)+'/trip/resume','POST',{at}),
 complete:(id:string,v:{at?:string;distanceKm:number|null})=>send<DeliveryDetail>(one(id)+'/trip/complete','POST',v),
 distance:(id:string,distanceKm:number|null)=>send<DeliveryDetail>(one(id)+'/trip/distance','PUT',{distanceKm}),
 cancel:(id:string)=>send<DeliveryDetail>(one(id)+'/cancel','POST'),
 createLink:(id:string,noteId:string,purpose:DeliveryLinkPurpose,validDays:number)=>send<{purpose:DeliveryLinkPurpose;url:string;expiresAtUtc:string}>(one(id)+'/notes/'+noteId+'/links','POST',{purpose,validDays}),
 revokeLink:(id:string,noteId:string,purpose:DeliveryLinkPurpose)=>send<DeliveryDetail>(one(id)+'/notes/'+noteId+'/links/'+purpose,'DELETE'),
 transaction:(id:string,v:{type:'INCOME'|'EXPENSE';category:string;amount:number;paymentMethod:string;notes?:string;currency?:string;exchangeRate?:number;deliveryNoteId?:string|null;paidByEmployeeId?:string|null})=>send<DeliveryDetail>(one(id)+'/transactions','POST',v)
}

// Labels are getters: read at render, they follow the chosen language.
const status=(key:string,color:string)=>({get label(){return t(key)},color})
export const DELIVERY_STATUS:Record<DeliveryStatus,{label:string;color:string}>={PLANNED:status('shared.delivery.PLANNED','blue'),OUT_FOR_DELIVERY:status('shared.delivery.OUT_FOR_DELIVERY','orange'),COMPLETED:status('shared.delivery.COMPLETED','green'),CANCELLED:status('shared.delivery.CANCELLED','default')}
export const ITEM_STATUS:Record<DeliveryItemStatus,{label:string;color:string}>={LOADED:status('shared.deliveryItem.LOADED','blue'),DELIVERED:status('shared.deliveryItem.DELIVERED','green'),RETURNED:status('shared.deliveryItem.RETURNED','volcano')}

/** Customer link calls. Sent without the staff session so a signed-in browser cannot switch the tenant. */
const anonymous=async<T,>(url:string,body?:unknown):Promise<T>=>{
 const response=await fetch(apiUrl(url),body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
 const data=await response.json().catch(()=>null)
 if(!response.ok)throw new Error(serverMessage(data,response.status)) // the server's message code, in the user's language
 return data as T
}
const publicBase=(token:string)=>'/api/public/delivery-notes/'+encodeURIComponent(token)
export const publicDeliveryApi={
 get:(token:string)=>anonymous<PublicDeliveryNote>(publicBase(token)),
 respondDate:(token:string,v:{confirmed:boolean;preferredAtUtc?:string})=>anonymous<PublicDeliveryNote>(publicBase(token)+'/schedule',v),
 shareLocation:(token:string,v:{latitude?:number;longitude?:number;address?:string;notes?:string})=>anonymous<PublicDeliveryNote>(publicBase(token)+'/location',v)
}
