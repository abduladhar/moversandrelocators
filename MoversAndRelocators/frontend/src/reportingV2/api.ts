import {request} from '../api'

export type ReportTypeInfo={type:string;label:string;module:string}
export type TemplateDetails={type:string;name:string;layout:string;isDefault:boolean;listOnPrint:boolean;revision:number;updatedBy?:string|null;updatedAt:string}
export type TemplateV2={id:string;version:string;details:TemplateDetails}
export type Branding={companyName?:string|null;logo?:string|null;address?:string|null;phone?:string|null;email?:string|null;website?:string|null;taxId?:string|null;footerNote?:string|null}
export type TemplateHistory={templateId:string;action:string;actor?:string|null;at:string;template:TemplateDetails}

const base='/api/report-v2'
const json=(method:string,body:unknown)=>({method,body:JSON.stringify(body)})
export const reportV2Api={
 types:()=>request<ReportTypeInfo[]>(base+'/types'),
 /** Default and list-on-print templates of a type (for printing). */
 printTemplates:(type:string)=>request<TemplateV2[]>(base+'/templates?type='+encodeURIComponent(type)),
 manage:(type?:string)=>request<TemplateV2[]>(base+'/templates/manage'+(type?'?type='+encodeURIComponent(type):'')),
 get:(id:string)=>request<TemplateV2>(base+'/templates/'+id),
 history:(id:string)=>request<TemplateHistory[]>(base+'/templates/'+id+'/history'),
 save:(id:string|undefined,value:{version?:string;type:string;name:string;layout:string;listOnPrint:boolean})=>request<TemplateV2>(base+'/templates'+(id?'/'+id:''),json(id?'PUT':'POST',value)),
 flags:(id:string,value:{version:string;isDefault?:boolean;listOnPrint?:boolean})=>request<TemplateV2>(base+'/templates/'+id+'/flags',json('PUT',value)),
 duplicate:(id:string)=>request<TemplateV2>(base+'/templates/'+id+'/duplicate',json('POST',{})),
 remove:(id:string)=>request<boolean>(base+'/templates/'+id,{method:'DELETE'}),
 /** Data record for one document; `query` carries report filters or document options (transactionId, packageIds…). */
 data:(type:string,id?:string,query?:Record<string,string>|string)=>{
  const q=new URLSearchParams(typeof query==='string'?query:query??{});if(id)q.set('id',id)
  return request<Record<string,unknown>>(base+'/data/'+encodeURIComponent(type)+'?'+q)
 },
 /** Tenant letterhead used by every report. */
 branding:()=>request<{version?:string|null;branding:Branding}>(base+'/branding'),
 saveBranding:(version:string|null|undefined,branding:Branding)=>request<{version:string;branding:Branding}>(base+'/branding',json('PUT',{version,branding})),
 sample:(type:string)=>request<Record<string,unknown>>(base+'/sample/'+encodeURIComponent(type)),
 publicPacking:(token:string)=>request<{layout?:string|null;name?:string|null;data:Record<string,unknown>}>('/api/public/packing/'+encodeURIComponent(token)+'/report-v2')
}
