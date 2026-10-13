import { Form, Input } from 'antd'
import type { WarehouseShipping } from '../warehouseApi'
import { useT } from '../i18n'

export function WarehouseShippingFields() {
  const { t } = useT()
  return <>
    <section className="warehouse-form-section"><h3>{t('warehouse.shipping.shipperSection')}</h3><div className="master-form-grid">
      <Form.Item name={['shipping', 'shipper', 'name']} label={t('warehouse.shipping.shipperName')}><Input maxLength={160} /></Form.Item>
      <Form.Item name={['shipping', 'shipper', 'phone']} label={t('warehouse.shipping.shipperPhone')}><Input maxLength={40} /></Form.Item>
    </div><Form.Item name={['shipping', 'shipper', 'address']} label={t('warehouse.shipping.shipperAddress')}><Input.TextArea maxLength={1000} rows={2} /></Form.Item></section>
    <section className="warehouse-form-section"><h3>{t('warehouse.shipping.consigneeSection')}</h3><div className="master-form-grid">
      <Form.Item name={['shipping', 'consignee', 'name']} label={t('warehouse.shipping.consigneeName')}><Input maxLength={160} /></Form.Item>
      <Form.Item name={['shipping', 'consignee', 'phone']} label={t('warehouse.shipping.consigneePhone')}><Input maxLength={40} /></Form.Item>
    </div><Form.Item name={['shipping', 'consignee', 'address']} label={t('warehouse.shipping.consigneeAddress')}><Input.TextArea maxLength={1000} rows={2} /></Form.Item></section>
    <section className="warehouse-form-section"><h3>{t('warehouse.shipping.destinationSection')}</h3><div className="master-form-grid">
      <Form.Item name={['shipping', 'toLocation']} label={t('warehouse.shipping.toLocation')}><Input maxLength={200} placeholder={t('warehouse.shipping.toLocationPlaceholder')} /></Form.Item>
      <Form.Item name={['shipping', 'dropLocation']} label={t('warehouse.shipping.dropLocation')}><Input maxLength={200} placeholder={t('warehouse.shipping.dropLocationPlaceholder')} /></Form.Item>
    </div><Form.Item name={['shipping', 'dropAddress']} label={t('warehouse.shipping.dropAddress')}><Input.TextArea maxLength={1000} rows={3} placeholder={t('warehouse.shipping.dropAddressPlaceholder')} /></Form.Item></section>
  </>
}
export function WarehouseShippingSummary({ shipping }: { shipping?: WarehouseShipping }) {
  const { t } = useT()
  return <><h3>{t('warehouse.shipping.summaryTitle')}</h3><dl className="packing-document-facts">
    <div><dt>{t('warehouse.shipping.shipper')}</dt><dd>{shipping?.shipper?.name || '—'}<br />{shipping?.shipper?.phone || '—'}<br />{shipping?.shipper?.address || '—'}</dd></div>
    <div><dt>{t('warehouse.shipping.consignee')}</dt><dd>{shipping?.consignee?.name || '—'}<br />{shipping?.consignee?.phone || '—'}<br />{shipping?.consignee?.address || '—'}</dd></div>
    <div><dt>{t('warehouse.shipping.toLocation')}</dt><dd>{shipping?.toLocation || '—'}</dd></div><div><dt>{t('warehouse.shipping.dropLocation')}</dt><dd>{shipping?.dropLocation || '—'}</dd></div>
    <div className="packing-fact-wide"><dt>{t('warehouse.shipping.dropAddress')}</dt><dd>{shipping?.dropAddress || '—'}</dd></div>
  </dl></>
}
