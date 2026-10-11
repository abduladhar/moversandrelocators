import { useEffect, useState } from 'react'
import { Alert, Button, Card, Form, Input, Typography, message } from 'antd'
import { KeyOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { authApi, setupApi } from '../api'
import type { AuthSession } from '../types'
import { BrandMark } from '../components/BrandMark'
import { lastCompany, rememberCompany } from '../session'

type SetupStatus = { needsSetup: boolean; enabled: boolean; requiresKey: boolean }
type SetupValues = { fullName: string; email: string; password: string; confirm: string; setupKey?: string }

export function LoginPage({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [setup, setSetup] = useState<SetupStatus | null>(null), [signInInstead, setSignInInstead] = useState(false), [createAdmin, setCreateAdmin] = useState(false)
  const [statusError, setStatusError] = useState('')
  const loadStatus = () => setupApi.status().then(x => { setSetup(x); setStatusError('') }).catch(e => { setSetup(null); setStatusError(e instanceof Error ? e.message : 'The server could not be reached.') })
  useEffect(() => { void loadStatus() }, [])
  const submit = async (values: { email: string; password: string }) => {
    setBusy(true); setError('')
    try { const session = await authApi.login(values.email, values.password, lastCompany()); if (session.canSwitchCompany) rememberCompany(session.companyId); onLogin(session) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to sign in.') }
    finally { setBusy(false) }
  }
  const submitAdmin = async (values: SetupValues) => {
    setBusy(true); setError('')
    try {
      const session = await setupApi.createSystemAdmin({ fullName: values.fullName, email: values.email, password: values.password, setupKey: values.setupKey })
      message.success(session.passwordReset ? 'Password reset. You are signed in.' : 'System administrator created. You are signed in.')
      onLogin(session)
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to create the administrator.') }
    finally { setBusy(false) }
  }
  /** First run (no administrator yet), or the "Create system administrator" option, which needs the setup key. */
  const showSetup = (Boolean(setup?.needsSetup) && !signInInstead) || createAdmin

  return <div className="login-page">
    <section className="login-story"><div className="brand"><BrandMark size={40} /><b>crateway</b></div><div><Typography.Text className="story-label">RELOCATION OPERATIONS</Typography.Text><Typography.Title>Every move.<br />One clear view.</Typography.Title><Typography.Paragraph>Securely manage teams, warehouses, transportation and financials across every tenant.</Typography.Paragraph></div><div className="security-note"><SafetyCertificateOutlined /><div><strong>Tenant-safe by design</strong><small>Role-based access and a complete activity record protect every operation.</small></div></div></section>
    <main className="login-main">
      {showSetup ? <Card className="login-card" variant="borderless">
        <Typography.Text className="eyebrow">{setup?.needsSetup ? 'FIRST-TIME SETUP' : 'PLATFORM ADMINISTRATION'}</Typography.Text>
        <Typography.Title level={2}>{setup?.needsSetup ? 'Create the system administrator' : 'Create system administrator'}</Typography.Title>
        <Typography.Paragraph type="secondary">{setup?.needsSetup ? 'No administrator exists yet. This account manages the platform: it registers tenants and their users.' : 'Requires the setup key from the server settings. If the email already belongs to a system administrator, that account\'s password is reset to the one you enter.'}</Typography.Paragraph>
        {error && <Alert type="error" showIcon title={error} />}
        {!setup ? <Alert type="error" showIcon title="The server could not be reached" description={<>{statusError || 'Checking the server…'} Check that the web app points at the API over https, then <Button type="link" size="small" style={{ padding: 0 }} onClick={() => void loadStatus()}>try again</Button>.</>} />
          : !setup.enabled ? <Alert type="warning" showIcon title="Creating a system administrator is turned off on this server" description="Add a setup key of at least 16 characters to the API settings (Setup:Key in appsettings.json, or the Setup__Key environment variable) and restart the API. Then enter that key here." />
          : <Form layout="vertical" onFinish={submitAdmin} requiredMark={false} className="login-setup-form">
            <Form.Item label="Full name" name="fullName" rules={[{ required: true, whitespace: true, min: 2, max: 160 }]}><Input size="large" prefix={<UserOutlined />} autoComplete="name" placeholder="Your name" /></Form.Item>
            <Form.Item label="Email address" name="email" rules={[{ required: true }, { type: 'email' }]}><Input size="large" prefix={<MailOutlined />} autoComplete="username" placeholder="admin@company.com" /></Form.Item>
            <Form.Item label="Password" name="password" extra="At least 10 characters." rules={[{ required: true }, { min: 10, message: 'Use at least 10 characters' }]}><Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" /></Form.Item>
            <Form.Item label="Confirm password" name="confirm" dependencies={['password']} rules={[{ required: true, message: 'Repeat the password' }, ({ getFieldValue }) => ({ validator: (_, v) => !v || v === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error('The passwords do not match')) })]}><Input.Password size="large" prefix={<LockOutlined />} autoComplete="new-password" /></Form.Item>
            {setup.requiresKey && <Form.Item label="Setup key" name="setupKey" extra="The key in the server settings (Setup:Key)." rules={[{ required: true, message: 'Enter the setup key' }]}><Input.Password size="large" prefix={<KeyOutlined />} autoComplete="off" /></Form.Item>}
            <Button block size="large" type="primary" htmlType="submit" loading={busy}>Create administrator and sign in</Button>
          </Form>}
        <Button type="link" block className="login-switch" onClick={() => { setSignInInstead(true); setCreateAdmin(false); setError('') }}>Back to sign in</Button>
      </Card>
      : <Card className="login-card" variant="borderless"><Typography.Text className="eyebrow">SECURE ACCESS</Typography.Text><Typography.Title level={2}>Welcome back</Typography.Title><Typography.Paragraph type="secondary">Sign in to your operations workspace.</Typography.Paragraph>{error && <Alert type="error" showIcon title={error} />}
        <Form layout="vertical" onFinish={submit} requiredMark={false}><Form.Item label="Email address" name="email" rules={[{ required: true }, { type: 'email' }]}><Input size="large" prefix={<MailOutlined />} autoComplete="username" placeholder="you@company.com" /></Form.Item><Form.Item label="Password" name="password" rules={[{ required: true }]}><Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" placeholder="Enter your password" /></Form.Item><Button block size="large" type="primary" htmlType="submit" loading={busy}>Sign in securely</Button></Form>
        {/* Always offered; the form explains when the server is unreachable or has no setup key. */}
        <Button type="link" block className="login-switch" onClick={() => { setCreateAdmin(true); setSignInInstead(false); setError(''); void loadStatus() }}>Create system administrator</Button>
      </Card>}
    </main>
  </div>
}
