import {useEffect,useState} from 'react'
import {Alert,Button,Card,Col,Form,Input,Row,Space,Spin,Upload,message} from 'antd'
import {DeleteOutlined,UploadOutlined} from '@ant-design/icons'
import {reportV2Api,type Branding} from './api'

const IMAGE_TYPES=['image/png','image/jpeg','image/gif','image/webp']
/** Ready-made logos (public/sample-logos) to try the letterhead before the real logo is uploaded. */
const SAMPLE_LOGOS=[['al-kareem-emblem','Emblem'],['al-kareem-badge','Badge'],['al-kareem-monogram','Monogram'],['al-kareem-home','Home']]

/**
 * Tenant letterhead: the logo, company name, address and contact lines printed at the top of every report,
 * and the note printed in the bottom margin. Templates bind to {{company.*}}, so saving here updates all
 * reports without touching templates. Blank fields fall back to the tenant profile.
 */
export function LetterheadSettings(){
 const [form]=Form.useForm<Branding>()
 const [version,setVersion]=useState<string|null|undefined>(),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('')
 const [preview,setPreview]=useState<Branding>({})
 useEffect(()=>{reportV2Api.branding().then(r=>{setVersion(r.version);form.setFieldsValue(r.branding);setPreview(r.branding)}).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[form])
 const logo=Form.useWatch('logo',form)
 const upload=(file:File)=>{
  if(!IMAGE_TYPES.includes(file.type)){message.error('Use a PNG, JPEG, GIF or WebP image.');return false}
  if(file.size>1024*1024){message.error('The logo must be 1 MB or smaller.');return false}
  const r=new FileReader();r.onload=()=>{form.setFieldValue('logo',String(r.result));setPreview(form.getFieldsValue(true))};r.readAsDataURL(file);return false
 }
 const applySample=async(name:string)=>{
  try{const blob=await (await fetch('/sample-logos/'+name+'.png')).blob()
   const r=new FileReader();r.onload=()=>{form.setFieldValue('logo',String(r.result));setPreview(form.getFieldsValue(true));message.info('Sample logo applied. Save to use it on every report.')};r.readAsDataURL(blob)}
  catch{message.error('Could not load the sample logo.')}
 }
 const save=async()=>{
  setSaving(true)
  try{const r=await reportV2Api.saveBranding(version,form.getFieldsValue(true));setVersion(r.version);form.setFieldsValue(r.branding);setPreview(r.branding);message.success('Letterhead saved. All reports now use it.')}
  catch(e){message.error(e instanceof Error?e.message:'Save failed')}
  finally{setSaving(false)}
 }
 if(loading)return <div style={{padding:40,textAlign:'center'}}><Spin/></div>
 const contact=[preview.phone,preview.email,preview.website].filter(Boolean).join('  ·  ')
 return <Row gutter={24}>
  <Col xs={24} lg={11}>
   {error&&<Alert type="error" showIcon title={error} style={{marginBottom:16}}/>}
   <Form form={form} layout="vertical" onValuesChange={(_,all)=>setPreview(all)}>
    <Form.Item label="Logo" extra="Printed at the top left of every report. PNG, JPEG, GIF or WebP, up to 1 MB. A wide logo on a transparent background looks best.">
     <Space>
      <Upload accept={IMAGE_TYPES.join(',')} showUploadList={false} beforeUpload={upload}><Button icon={<UploadOutlined/>}>{logo?'Replace logo':'Upload logo'}</Button></Upload>
      {logo&&<Button danger icon={<DeleteOutlined/>} onClick={()=>{form.setFieldValue('logo',null);setPreview(form.getFieldsValue(true))}}>Remove</Button>}
     </Space>
     <div className="letterhead-samples"><small>Or use a sample logo</small><div>{SAMPLE_LOGOS.map(([name,label])=><button key={name} type="button" className="letterhead-sample" title={label} onClick={()=>void applySample(name)}><img src={'/sample-logos/'+name+'.png'} alt={label+' sample logo'}/></button>)}</div></div>
    </Form.Item>
    <Form.Item name="logo" hidden><Input/></Form.Item>
    <Form.Item name="companyName" label="Company name" extra="Leave blank to use the tenant name."><Input maxLength={200}/></Form.Item>
    <Form.Item name="address" label="Address" extra="Printed at the top right. Use separate lines for building, street, city and country."><Input.TextArea maxLength={1000} autoSize={{minRows:3,maxRows:6}}/></Form.Item>
    <Row gutter={12}>
     <Col span={12}><Form.Item name="phone" label="Phone"><Input maxLength={100}/></Form.Item></Col>
     <Col span={12}><Form.Item name="email" label="Email"><Input maxLength={200}/></Form.Item></Col>
     <Col span={12}><Form.Item name="website" label="Website"><Input maxLength={200}/></Form.Item></Col>
     <Col span={12}><Form.Item name="taxId" label="Tax / registration no."><Input maxLength={100}/></Form.Item></Col>
    </Row>
    <Form.Item name="footerNote" label="Footer note" extra="Printed in the bottom margin of every page. Blank uses “This is a system generated document, no signature is required”."><Input maxLength={300}/></Form.Item>
    <Button type="primary" loading={saving} onClick={()=>void save()}>Save letterhead</Button>
   </Form>
  </Col>
  <Col xs={24} lg={13}>
   <Card size="small" title="Preview" styles={{body:{background:'#eef1f5'}}}>
    <div style={{background:'#fff',padding:'24px 28px 16px',boxShadow:'0 2px 10px rgba(20,30,50,.08)',fontFamily:'Arial, sans-serif',color:'#1f2733'}}>
     <div style={{display:'flex',justifyContent:'space-between',gap:24,minHeight:72}}>
      <div style={{flex:'0 0 auto',maxWidth:'45%'}}>{preview.logo?<img src={preview.logo} alt="Logo" style={{maxWidth:200,maxHeight:70,objectFit:'contain'}}/>:<div style={{fontSize:20,fontWeight:700,color:'#176b52'}}>{preview.companyName||'Company name'}</div>}</div>
      <div style={{textAlign:'right',fontSize:11,color:'#4a5568',lineHeight:1.45}}>
       <div style={{fontSize:13,fontWeight:700,color:'#1f2733'}}>{preview.companyName||'Company name'}</div>
       <div style={{whiteSpace:'pre-line'}}>{preview.address||'Address'}</div>
       {contact&&<div>{contact}</div>}
       {preview.taxId&&<div>Tax ID: {preview.taxId}</div>}
      </div>
     </div>
     <div style={{height:2,background:'#176b52',margin:'10px 0 18px'}}/>
     <div style={{fontSize:20,fontWeight:700,color:'#176b52'}}>INVOICE</div>
     <div style={{height:90,borderTop:'1px solid #eef1f5',marginTop:12,background:'repeating-linear-gradient(#fff 0 22px,#f6f8f7 22px 44px)'}}/>
     <div style={{fontSize:8,color:'#9aa4b2',marginTop:12}}>{preview.footerNote||'THIS IS A SYSTEM GENERATED DOCUMENT, NO SIGNATURE IS REQUIRED'}</div>
    </div>
   </Card>
  </Col>
 </Row>
}
