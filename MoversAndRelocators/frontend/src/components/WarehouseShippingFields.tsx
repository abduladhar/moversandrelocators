import { Form, Input } from 'antd'
import type { WarehouseShipping } from '../warehouseApi'

export function WarehouseShippingFields() {
  return <>
    <section className="warehouse-form-section"><h3>Shipper information</h3><div className="master-form-grid">
      <Form.Item name={['shipping', 'shipper', 'name']} label="Shipper name"><Input maxLength={160} /></Form.Item>
      <Form.Item name={['shipping', 'shipper', 'phone']} label="Shipper phone number"><Input maxLength={40} /></Form.Item>
    </div><Form.Item name={['shipping', 'shipper', 'address']} label="Shipper address"><Input.TextArea maxLength={1000} rows={2} /></Form.Item></section>
    <section className="warehouse-form-section"><h3>Consignee information</h3><div className="master-form-grid">
      <Form.Item name={['shipping', 'consignee', 'name']} label="Consignee name"><Input maxLength={160} /></Form.Item>
      <Form.Item name={['shipping', 'consignee', 'phone']} label="Consignee phone number"><Input maxLength={40} /></Form.Item>
    </div><Form.Item name={['shipping', 'consignee', 'address']} label="Consignee address"><Input.TextArea maxLength={1000} rows={2} /></Form.Item></section>
    <section className="warehouse-form-section"><h3>Destination & drop-off</h3><div className="master-form-grid">
      <Form.Item name={['shipping', 'toLocation']} label="To location"><Input maxLength={200} placeholder="Destination city or area" /></Form.Item>
      <Form.Item name={['shipping', 'dropLocation']} label="Drop location"><Input maxLength={200} placeholder="Delivery point or site name" /></Form.Item>
    </div><Form.Item name={['shipping', 'dropAddress']} label="Drop address"><Input.TextArea maxLength={1000} rows={3} placeholder="Full delivery address" /></Form.Item></section>
  </>
}
export function WarehouseShippingSummary({ shipping }: { shipping?: WarehouseShipping }) {
  return <><h3>Shipper & consignee</h3><dl className="packing-document-facts">
    <div><dt>Shipper</dt><dd>{shipping?.shipper?.name || '—'}<br />{shipping?.shipper?.phone || '—'}<br />{shipping?.shipper?.address || '—'}</dd></div>
    <div><dt>Consignee</dt><dd>{shipping?.consignee?.name || '—'}<br />{shipping?.consignee?.phone || '—'}<br />{shipping?.consignee?.address || '—'}</dd></div>
    <div><dt>To location</dt><dd>{shipping?.toLocation || '—'}</dd></div><div><dt>Drop location</dt><dd>{shipping?.dropLocation || '—'}</dd></div>
    <div className="packing-fact-wide"><dt>Drop address</dt><dd>{shipping?.dropAddress || '—'}</dd></div>
  </dl></>
}
