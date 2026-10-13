import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography, message } from 'antd'
import { KeyOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { authApi, setupApi } from '../api'
import type { AuthSession } from '../types'
import { BrandMark } from '../components/BrandMark'
import { lastCompany, rememberCompany } from '../session'
import { useT } from '../i18n'
import { LanguageSwitcher } from '../i18n/LanguageSwitcher'

type SetupStatus = { needsSetup: boolean; enabled: boolean; requiresKey: boolean }
type SetupValues = { fullName: string; email: string; password: string; confirm: string; setupKey?: string }

export function LoginPage({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [setup, setSetup] = useState<SetupStatus | null>(null), [signInInstead, setSignInInstead] = useState(false), [createAdmin, setCreateAdmin] = useState(false)
  const [statusError, setStatusError] = useState('')
  const loadStatus = () => setupApi.status().then(x => { setSetup(x); setStatusError('') }).catch(e => { setSetup(null); setStatusError(e instanceof Error ? e.message : t('shell.login.serverUnreachable')) })
  useEffect(() => { void loadStatus() }, [])
  const submit = async (values: { email: string; password: string }) => {
    setBusy(true); setError('')
    try { const session = await authApi.login(values.email, values.password, lastCompany()); if (session.canSwitchCompany) rememberCompany(session.companyId); onLogin(session) }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('shell.login.signInFailed')) }
    finally { setBusy(false) }
  }
  const submitAdmin = async (values: SetupValues) => {
    setBusy(true); setError('')
    try {
      const session = await setupApi.createSystemAdmin({ fullName: values.fullName, email: values.email, password: values.password, setupKey: values.setupKey })
      message.success(session.passwordReset ? t('shell.login.passwordResetDone') : t('shell.login.adminCreated'))
      onLogin(session)
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('shell.login.adminCreateFailed')) }
    finally { setBusy(false) }
  }
  /** First run (no administrator yet), or the "Create system administrator" option, which needs the setup key. */
  const showSetup = (Boolean(setup?.needsSetup) && !signInInstead) || createAdmin

  return <div className="login-page">
    <section className="login-story"><div className="brand"><BrandMark size={40} /><b>crateway</b></div><div><Typography.Text className="story-label">{t('shell.login.storyLabel')}</Typography.Text><Typography.Title>{t('shell.login.storyTitleLine1')}<br />{t('shell.login.storyTitleLine2')}</Typography.Title><Typography.Paragraph>{t('shell.login.storyText')}</Typography.Paragraph></div><div className="security-note"><SafetyCertificateOutlined /><div><strong>{t('shell.login.securityTitle')}</strong><small>{t('shell.login.securityText')}</small></div></div></section>
    <main className="login-main" style={{ position: 'relative' }}>
      <div className="login-language" style={{ position: 'absolute', insetBlockStart: 16, insetInlineEnd: 16 }}><LanguageSwitcher /></div>
      {showSetup ? <Card className="login-card" variant="borderless">
        <Typography.Text className="eyebrow">{setup?.needsSetup ? t('shell.login.firstTimeSetup') : t('shell.login.platformAdministration')}</Typography.Text>
        <Typography.Title level={2}>{setup?.needsSetup ? t('shell.login.createTheAdminTitle') : t('shell.login.createAdmin')}</Typography.Title>
        <Typography.Paragraph type="secondary">{setup?.needsSetup ? t('shell.login.firstTimeText') : t('shell.login.setupKeyText')}</Typography.Paragraph>
        {error && <Alert type="error" showIcon title={error} />}
        {!setup ? <Alert type="error" showIcon title={t('shell.login.serverUnreachable')} description={<>{statusError || t('shell.login.checkingServer')} {t('shell.login.checkHttps')} <Button type="link" size="small" style={{ padding: 0 }} onClick={() => void loadStatus()}>{t('shell.login.tryAgain')}</Button></>} />
          : !setup.enabled ? <Alert type="warning" showIcon title={t('shell.login.setupDisabledTitle')} description={t('shell.login.setupDisabledText')} />
          : <Form layout="vertical" onFinish={submitAdmin} requiredMark={false} className="login-setup-form">
            <Form.Item label={t('shell.login.fullName')} name="fullName" rules={[{ required: true, whitespace: true, min: 2, max: 160 }]}><Input size="large" prefix={<UserOutlined />} autoComplete="name" placeholder={t('shell.login.yourName')} /></Form.Item>
            <Form.Item label={t('shell.login.emailAddress')} name="email" rules={[{ required: true }, { type: 'email' }]}><Input size="large" prefix={<MailOutlined />} autoComplete="username" placeholder="admin@company.com" /></Form.Item>
            <Form.Item label={t('shell.login.password')} name="password" extra={t('shell.login.passwordHint')} rules={[{ required: true }, { min: 10, message: t('shell.login.passwordMin') }]}><Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" /></Form.Item>
            <Form.Item label={t('shell.login.confirmPassword')} name="confirm" dependencies={['password']} rules={[{ required: true, message: t('shell.login.repeatPassword') }, ({ getFieldValue }) => ({ validator: (_, v) => !v || v === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error(t('shell.login.passwordsDiffer'))) })]}><Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" /></Form.Item>
            {setup.requiresKey && <Form.Item label={t('shell.login.setupKey')} name="setupKey" extra={t('shell.login.setupKeyHint')} rules={[{ required: true, message: t('shell.login.setupKeyRequired') }]}><Input.Password size="large" prefix={<KeyOutlined />} autoComplete="off" /></Form.Item>}
            <Button block size="large" type="primary" htmlType="submit" loading={busy}>{t('shell.login.createAdminAndSignIn')}</Button>
          </Form>}
        <Button type="link" block className="login-switch" onClick={() => { setSignInInstead(true); setCreateAdmin(false); setError('') }}>{t('shell.login.backToSignIn')}</Button>
      </Card>
      : <Card className="login-card" variant="borderless"><Typography.Text className="eyebrow">{t('shell.login.secureAccess')}</Typography.Text><Typography.Title level={2}>{t('shell.login.welcomeBack')}</Typography.Title><Typography.Paragraph type="secondary">{t('shell.login.signInIntro')}</Typography.Paragraph>{error && <Alert type="error" showIcon title={error} />}
        <Form layout="vertical" onFinish={submit} requiredMark={false}><Form.Item label={t('shell.login.emailAddress')} name="email" rules={[{ required: true }, { type: 'email' }]}><Input size="large" prefix={<MailOutlined />} autoComplete="username" placeholder="you@company.com" /></Form.Item><Form.Item label={t('shell.login.password')} name="password" rules={[{ required: true }]}><Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" placeholder={t('shell.login.passwordPlaceholder')} /></Form.Item><Button block size="large" type="primary" htmlType="submit" loading={busy}>{t('shell.login.signIn')}</Button></Form>
        {/* Always offered; the form explains when the server is unreachable or has no setup key. */}
        <Button type="link" block className="login-switch" onClick={() => { setCreateAdmin(true); setSignInInstead(false); setError(''); void loadStatus() }}>{t('shell.login.createAdmin')}</Button>
      </Card>}
    </main>
  </div>
}
