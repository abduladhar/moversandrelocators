import { RefreshButton } from './components/RefreshButton'
import { useState } from 'react'
import { ConfigProvider } from 'antd'
import { I18nProvider, useT } from './i18n'
import { antdLocales } from './i18n/antd'
import { LanguageSwitcher } from './i18n/LanguageSwitcher'
import type { AuthSession } from './types'
import { readSession, saveSession } from './session'
import { LoginPage } from './pages/LoginPage'
import { WorkspaceLayout } from './layout/WorkspaceLayout'
import { CustomerUploadPage } from './pages/CustomerUploadPage'
import { CustomerLeadInventoryPage } from './pages/CustomerLeadInventoryPage'
import { CustomerSurveyPage } from './pages/CustomerSurveyPage'
import { CustomerQuotationPage } from './pages/CustomerQuotationPage'
import { CustomerPackingPage } from './pages/CustomerPackingPage'
import { CustomerPickupPage } from './pages/CustomerPickupPage'
import { CustomerPackingDatePage, CustomerPackingItemsPage, CustomerPackingLocationPage } from './pages/CustomerPackingLinkPages'
import { PoweredBy } from './components/BrandMark'
import { CustomerDeliveryDatePage, CustomerDeliveryLocationPage } from './pages/CustomerDeliveryLinkPages'

export default function App() {
  return <I18nProvider><Routes /></I18nProvider>
}

function Routes() {
  const { language, dir, t } = useT()
  // Hosts may add a trailing slash to customer links (e.g. Amplify's 301 to /upload/<token>/), so ignore it.
  const path = window.location.pathname.replace(/\/+$/, '')
  const packingToken = path.match(/^\/packing\/([^/]+)$/)?.[1]
  const uploadToken = path.match(/^\/upload\/([^/]+)$/)?.[1]
  const inventoryToken = path.match(/^\/inventory\/([^/]+)$/)?.[1]
  const surveyToken = path.match(/^\/survey-confirm\/([^/]+)$/)?.[1]
  const quotationToken = path.match(/^\/quotation\/([^/]+)$/)?.[1]
  const pickupToken = path.match(/^\/pickup\/([^/]+)$/)?.[1]
  const [, packingLink, packingLinkToken] = path.match(/^\/packing-(date|location|items)\/([^/]+)$/) ?? []
  const packingJobToken = packingLinkToken && decodeURIComponent(packingLinkToken)
  const [, deliveryLink, deliveryLinkToken] = path.match(/^\/delivery-(date|location)\/([^/]+)$/) ?? []
  const deliveryToken = deliveryLinkToken && decodeURIComponent(deliveryLinkToken)
  const [session, setSession] = useState<AuthSession | null>(readSession)
  const updateSession = (next: AuthSession | null) => { saveSession(next); setSession(next) }
  return <ConfigProvider locale={antdLocales[language]} direction={dir} theme={{ token: { colorPrimary: '#176b52', colorInfo: '#176b52', borderRadius: 8, fontFamily: "Inter, 'Segoe UI', sans-serif" }, components: { Layout: { siderBg: '#10271f' }, Menu: { darkItemBg: '#10271f', darkItemSelectedBg: '#245441' }, Table: { headerBg: '#f7f9f8' } } }}>
    {(packingToken || uploadToken || inventoryToken || surveyToken || quotationToken || pickupToken || packingJobToken || deliveryToken) && <div className="public-refresh-bar"><RefreshButton onRefresh={() => window.location.reload()} confirmText={t('common.publicReloadConfirm')} /><LanguageSwitcher compact /></div>}
    {packingToken ? <CustomerPackingPage token={decodeURIComponent(packingToken)} /> : uploadToken ? <CustomerUploadPage token={decodeURIComponent(uploadToken)} /> : inventoryToken ? <CustomerLeadInventoryPage token={decodeURIComponent(inventoryToken)} /> : surveyToken ? <CustomerSurveyPage token={decodeURIComponent(surveyToken)} /> : quotationToken ? <CustomerQuotationPage token={decodeURIComponent(quotationToken)} /> : pickupToken ? <CustomerPickupPage token={decodeURIComponent(pickupToken)} /> : packingJobToken ? (packingLink === 'date' ? <CustomerPackingDatePage token={packingJobToken} /> : packingLink === 'location' ? <CustomerPackingLocationPage token={packingJobToken} /> : <CustomerPackingItemsPage token={packingJobToken} />) : deliveryToken ? (deliveryLink === 'date' ? <CustomerDeliveryDatePage token={deliveryToken} /> : <CustomerDeliveryLocationPage token={deliveryToken} />) : session ? <WorkspaceLayout session={session} onSession={updateSession} /> : <LoginPage onLogin={updateSession} />}
    {(packingToken || uploadToken || inventoryToken || surveyToken || quotationToken || pickupToken || packingJobToken || deliveryToken) && <PoweredBy />}
  </ConfigProvider>
}

