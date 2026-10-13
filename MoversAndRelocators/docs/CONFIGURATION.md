# Configuration

The API checks its settings at startup and refuses to start if a required value is missing or invalid.

| Environment | Where values may come from |
|---|---|
| Development | `appsettings.Development.json` (git-ignored; copy `appsettings.Development.example.json`) or environment variables |
| Testing (automated tests) | `appsettings.Testing.json` (throwaway test values) |
| Any other (Production, Staging…) | Secrets **must** be environment variables. A secret found only in a settings file stops startup. |

`appsettings.json` holds no secrets and no addresses; it is shared by every environment.

## Required settings

Environment variable names use `__` for each `:` level.

| Setting | Environment variable | Secret | Notes |
|---|---|---|---|
| `ConnectionStrings:SqlServer` (or `:PostgreSql`, matching `Database:Provider`) | `ConnectionStrings__SqlServer` | Yes | Database connection string. |
| `Jwt:SigningKey` | `Jwt__SigningKey` | Yes | At least 32 characters, random. Changing it signs everyone out. |
| `CredentialEncryption:Key` | `CredentialEncryption__Key` | Yes | Base64 of 16, 24 or 32 random bytes. Encrypts the tenants' AWS/OpenAI/Claude keys; **keep it stable**, or stored keys can no longer be read. |
| `Bootstrap:SystemAdminEmail` | `Bootstrap__SystemAdminEmail` | No | **Optional.** When set (with the password), this system administrator is created on startup. When unset, use first-time setup instead (below). |
| `Bootstrap:SystemAdminPassword` | `Bootstrap__SystemAdminPassword` | Yes | Required only when `Bootstrap:SystemAdminEmail` is set. Used only when the account is **first created**; changing it later does not change an existing account's password (see `Bootstrap:ResetPassword`). |
| `Bootstrap:ResetPassword` | `Bootstrap__ResetPassword` | No | Recovery switch. `true` sets the bootstrap administrator's password to `Bootstrap:SystemAdminPassword` (and reactivates the account) on every start. Turn it on, restart once, sign in, then **remove it**. The API logs a warning while it is on. |
| `Setup:Key` | `Setup__Key` | Yes | At least 16 random characters. May be set in `appsettings.json` **or** as an environment variable. When set, the sign-in page shows **Create system administrator** at any time. Whoever enters this key can create a system administrator, or reset an existing administrator's password by entering that administrator's email. Without it, an administrator can be created there only on a first run in Development/Testing. **Anyone who has this key can take full control**: keep it private, and remove it when you don't need it. |
| `ClientOrigin` | `ClientOrigin` | No | Address(es) the web app is served from, for CORS. Several are separated by commas. |
| `PublicApp:BaseUrl` | `PublicApp__BaseUrl` | No | Address customers open links at (survey, quotation, pickup, packing, delivery, uploads). There is no fallback. |
| `PublicApi:BaseUrl` | `PublicApi__BaseUrl` | No | The API's own public address, e.g. `https://api.yourcompany.com`. **Required when the web app is on a different domain and `Storage:Provider` is `Local`**, so file upload and download links point at the API. Leave unset when both share one domain. |
| `Storage:Provider` | `Storage__Provider` | No | `Local` stores files on the server; anything else (or unset) uses Amazon S3 with each tenant's AWS settings. |
| `Storage:LocalRoot` | `Storage__LocalRoot` | No | Folder for files when `Local`. Keep it outside the app folder so a redeploy does not delete it. |

### First start without users

1. Set `Setup:Key` (in `appsettings.json` or as `Setup__Key`) to a random value of 16+ characters. `Bootstrap` settings are optional.
2. Open the web app and choose **Create system administrator** on the sign-in page. Enter a name, email, password and the setup key. You are signed in as the system administrator. Entering an existing administrator's email resets that account's password instead.
3. Go to **Tenant workspace › Register tenant**. Fill in the company and, optionally, its **first administrator** (name, email, temporary password).
4. Use **Users** on a tenant row to add or deactivate that tenant's users, choosing a role. Users created here have no employee link; the tenant can link one later on its own Users page.

With the web app and API on separate domains, `ClientOrigin` and `PublicApp:BaseUrl` are the **web app's** address, and `PublicApi:BaseUrl` is the **API's** address.

Example (PowerShell):

```powershell
$env:ASPNETCORE_ENVIRONMENT = "Production"
$env:ConnectionStrings__SqlServer = "Server=db;Database=MoversRelocatordb;User Id=movers_app;Password=…;Encrypt=True"
$env:Jwt__SigningKey = "<random 32+ characters>"
$env:CredentialEncryption__Key = "<base64 of 32 random bytes>"
$env:Setup__Key = "<random value, entered once on the first-time setup screen>"
$env:ClientOrigin = "https://app.yourcompany.com"
$env:PublicApp__BaseUrl = "https://app.yourcompany.com"
$env:PublicApi__BaseUrl = "https://api.yourcompany.com"
```

## Web app (client)

The web app reads one setting, at **build time** (`npm run build`), from an environment variable or `frontend/.env.production`:

| Variable | Required | Example | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | When the API is on another domain | `https://api.yourcompany.com` | Address of the API, without `/api`. Leave empty when `/api` is served on the web app's own domain. |

It is baked into the built files, so rebuild after changing it. It is not a secret: anyone can see it in the browser. In development it stays empty and `npm run dev` forwards `/api` to `http://localhost:5121`.

The web app's host must send every unknown path to `index.html` (single-page app), so customer links such as `/delivery-date/<token>` open.

## Starter data for new tenants

`TenantDefaults` in `appsettings.json` lists the taxes and charges every new tenant starts with (code, name, rate, tax %). They are country-specific: the shipped list is Indian GST with INR-level prices. Replace it for another country, for example UAE VAT 5%:

```json
"TenantDefaults": {
  "Taxes": [ { "Code": "VAT_5", "Name": "VAT 5%", "Kind": "TAX", "CalculationBasis": "TAXABLE_AMOUNT", "Rate": 5, "IsDefault": true } ],
  "Charges": [ { "Code": "SURVEY", "Name": "Survey service", "Unit": "service", "DefaultRate": 150, "TaxPercent": 5 } ]
}
```

An empty or missing section means new tenants start without taxes or charges. Existing tenants are not changed.

## Development-only features

- **Demo crew** (Crew › "Add demo employees") is only available when running in Development. The API returns 404 elsewhere and production builds hide the button.
