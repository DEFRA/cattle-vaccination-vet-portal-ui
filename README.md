# cattle-vaccination-vet-portal-ui

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_cattle-vaccination-vet-portal-ui&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=DEFRA_cattle-vaccination-vet-portal-ui)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_cattle-vaccination-vet-portal-ui&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=DEFRA_cattle-vaccination-vet-portal-ui)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=DEFRA_cattle-vaccination-vet-portal-ui&metric=coverage)](https://sonarcloud.io/summary/new_code?id=DEFRA_cattle-vaccination-vet-portal-ui)

Core delivery platform Node.js Frontend Template.

- [Requirements](#requirements)
  - [Node.js](#nodejs)
- [Server-side Caching](#server-side-caching)
- [Redis](#redis)
- [Translations](#translations)
- [Cookie consent](#cookie-consent)
- [Authentication](#authentication)
- [Local Development](#local-development)
  - [Setup](#setup)
  - [Development](#development)
  - [Production](#production)
  - [Npm scripts](#npm-scripts)
  - [Update dependencies](#update-dependencies)
  - [Formatting](#formatting)
    - [Windows prettier issue](#windows-prettier-issue)
- [Docker](#docker)
  - [Development image](#development-image)
  - [Production image](#production-image)
  - [Docker Compose](#docker-compose)
  - [Dependabot](#dependabot)
  - [SonarCloud](#sonarcloud)
- [Licence](#licence)
  - [About the licence](#about-the-licence)

## Requirements

### Node.js

Please install Node Version Manager [nvm](https://github.com/creationix/nvm)

To use the correct version of Node.js for this application, via nvm:

```bash
cd cattle-vaccination-vet-portal-ui
nvm use
```

## Server-side Caching

We use Catbox for server-side caching. By default the service will use CatboxRedis when deployed and CatboxMemory for
local development.
You can override the default behaviour by setting the `SESSION_CACHE_ENGINE` environment variable to either `redis` or
`memory`.

Please note: CatboxMemory (`memory`) is _not_ suitable for production use! The cache will not be shared between each
instance of the service and it will not persist between restarts.

## Redis

Redis is an in-memory key-value store. Every instance of a service has access to the same Redis key-value store similar
to how services might have a database (or MongoDB). All frontend services are given access to a namespaced prefixed that
matches the service name. e.g. `my-service` will have access to everything in Redis that is prefixed with `my-service`.

If your service does not require a session cache to be shared between instances or if you don't require Redis, you can
disable setting `SESSION_CACHE_ENGINE=false` or changing the default value in `src/config/index.js`.

## Translations

Nunjucks templates can use `{{ t('key') }}` for translations. The language is detected from the `?lang=` query
parameter, `i18next` cookie, or `Accept-Language` header, in that order. Selecting a language with `?lang=cy` stores it
in the `i18next` cookie for future requests. Other or unsupported languages fall back to English. Add strings to
`src/server/locales/en/common.json` and `src/server/locales/cy/common.json`.

## Cookie consent

The service uses [@transform-uk/govuk-analytics-consent](https://github.com/TransformCore/govuk-analytics-consent)
for its cookie banner and generated settings page at `/cookies`, linked from the footer. Both the banner and
settings form work without JavaScript and submit to `/govuk-analytics-consent/consent` with a Crumb CSRF token.
Preferences are stored for one year in `govuk_analytics_consent`. The essential cookie definitions also document
the browser-session `crumb` cookie, the one-year `i18next` language cookie, the authentication session cookie,
and the ten-minute `bell-entra` sign-in cookie. Rejecting optional cookies does not remove these.

Consent copy follows the request's i18next language. The package supplies English and Welsh defaults; service
overrides and custom cookie descriptions live under `govuk-analytics-consent` in the common translation catalogues.

GTM is disabled unless `GTM_CONTAINER_ID` is set to a valid container ID (for example, `GTM-XXXXXXX`).
Before enabling analytics tags, declare their presets in `src/server/plugins/cookie-consent.js` so their cookie
definitions, rejection cleanup, and CSP origins are included. No analytics tags are enabled by default.
The same consent configuration supplies Blankie's CSP sources. Script nonces protect the inline consent
bootstrap and GOV.UK scripts without allowing `unsafe-inline`; nonce- and token-bearing pages are not cached.

## Proxy

We are using forward-proxy which is set up by default. Services are automatically configured with the proxy environment variables when deployed.

Node.js 24 uses these variables to route outbound HTTP(S) requests through the proxy:

NODE_USE_ENV_PROXY=1
HTTPS_PROXY=...
NO_PROXY=...

No additional proxy configuration is required in the service.

## Authentication

All work order pages and work-list creation require sign-in through a single Microsoft Entra tenant.
Home, about, cookies, health checks and static assets remain public. There is no authentication bypass,
including in local development. Backend requests continue to use the existing service-to-service authentication;
user tokens are not forwarded to the backend.

Configure the existing Entra app registration with the **Web** platform and register the exact redirect URI
`http://localhost:3000/auth/sign-in-oidc` for local development. Register the corresponding HTTPS URI for each
deployed environment. The registration must be single-tenant and support authorization-code sign-in with
`openid`, `profile` and `email` scopes. Implicit grants, Microsoft Graph permissions, refresh-token permissions
and a Microsoft sign-out callback are not needed.

For local development, copy `.env.example` to `.env` and fill in the Entra values and both independently
generated cookie passwords. The server loads `.env` when you run `npm run dev`. Supply deployed settings through
the deployment's secret/configuration management instead.

| Environment variable      | Value                                                              |
| ------------------------- | ------------------------------------------------------------------ |
| `ENTRA_TENANT_ID`         | Directory (tenant) UUID, not `common` or `organizations`           |
| `ENTRA_CLIENT_ID`         | Application (client) UUID                                          |
| `ENTRA_CLIENT_SECRET`     | Client secret **value**, not its identifier                        |
| `ENTRA_REDIRECT_URL`      | Exact registered URL ending in `/auth/sign-in-oidc`                |
| `ENTRA_COOKIE_PASSWORD`   | Independently generated random password of at least 32 characters  |
| `SESSION_COOKIE_PASSWORD` | Independently generated random password of at least 32 characters  |
| `SESSION_COOKIE_SECURE`   | `true` for HTTPS; `false` only for local loopback HTTP development |

Generate each cookie password separately, for example with `openssl rand -base64 48`. Do not commit credentials
or local `.env` files. Rotate the app secret before it expires. Rotating a cookie password invalidates the
corresponding existing sessions or in-progress sign-ins. Startup fails if settings are missing or unsafe, or
the tenant's OpenID configuration cannot be loaded.

Bell handles authorization-code exchange, OAuth state and S256 PKCE. The portal verifies the ID token against
Entra's signing keys and checks its issuer, audience, tenant, lifetime and sign-in nonce. Only a minimal user
identity and absolute expiry are stored in the existing server-side Yar cache; tokens are not persisted.
Use the shared Redis session cache for deployed multi-instance environments, not the local memory cache.
Cookies are HttpOnly and SameSite=Lax, with Secure required for HTTPS. Session IDs rotate after sign-in.

Authentication expires at the earliest of the ID-token expiry, `SESSION_CACHE_TTL` and `SESSION_COOKIE_TTL`
(the latter two default to four hours). Tokens are not refreshed; an expired session starts a new sign-in,
which may complete through Microsoft's existing single sign-on. Safe work order links are restored after
sign-in, but submitted forms are never replayed.

The **Sign out** button submits a CSRF-protected POST and revokes only this application's session. It does not
sign the user out of Microsoft. Tenant sign-in eligibility is not per-work-order ownership authorization;
restrict user eligibility through enterprise-application assignment where required.

The flow follows the [DEFRA Entra example](https://github.com/DEFRA/fcp-entra-example), adapted to use Yar
without an additional `@hapi/cookie` session. Tests use explicit dummy settings and a local token endpoint,
not real tenant credentials. Before release, check a real Entra sign-in, cancellation, deep-link return,
work-list submission and sign-out, including outbound discovery, signing-key and token requests through the
deployment's HTTPS proxy. No Microsoft CSP script or connection permissions are required for browser redirects.

## Local Development

### Setup

Install application dependencies:

```bash
npm install
```

### Git hooks

Install git hooks (optional)

```bash
npm run git:hooks
```

### Development

To run the application in `development` mode run:

```bash
npm run dev
```

### Production

To mimic the application running in `production` mode locally run:

```bash
npm start
```

### Npm scripts

All available Npm scripts can be seen in [package.json](./package.json)
To view them in your command line run:

```bash
npm run
```

### Update dependencies

To update dependencies use [npm-check-updates](https://github.com/raineorshine/npm-check-updates):

> The following script is a good start. Check out all the options on
> the [npm-check-updates](https://github.com/raineorshine/npm-check-updates)

```bash
ncu --interactive --format group
```

### Formatting

#### Windows prettier issue

If you are having issues with formatting of line breaks on Windows update your global git config by running:

```bash
git config --global core.autocrlf false
```

## Docker

### Development image

> [!TIP]
> For Apple Silicon users, you may need to add `--platform linux/amd64` to the `docker run` command to ensure
> compatibility fEx: `docker build --platform=linux/arm64 --no-cache --tag cattle-vaccination-vet-portal-ui`

Build:

```bash
docker build --target development --no-cache --tag cattle-vaccination-vet-portal-ui:development .
```

Run:

```bash
docker run -p 3000:3000 cattle-vaccination-vet-portal-ui:development
```

### Production image

Build:

```bash
docker build --no-cache --tag cattle-vaccination-vet-portal-ui .
```

Run:

```bash
docker run -p 3000:3000 cattle-vaccination-vet-portal-ui
```

### Docker Compose

A local environment with:

- Floci (replacing Localstack) for AWS services (S3, SQS)
- Redis
- MongoDB
- This service.
- A commented out backend example.

```bash
docker compose up --build -d
```

### Dependabot

We have added an example dependabot configuration file to the repository. You can enable it by renaming
the [.github/example.dependabot.yml](.github/example.dependabot.yml) to `.github/dependabot.yml`

### SonarCloud

Instructions for setting up SonarCloud can be found in [sonar-project.properties](./sonar-project.properties).

## Licence

THIS INFORMATION IS LICENSED UNDER THE CONDITIONS OF THE OPEN GOVERNMENT LICENCE found at:

<http://www.nationalarchives.gov.uk/doc/open-government-licence/version/3>

The following attribution statement MUST be cited in your products and applications when using this information.

> Contains public sector information licensed under the Open Government license v3

### About the licence

The Open Government Licence (OGL) was developed by the Controller of Her Majesty's Stationery Office (HMSO) to enable
information providers in the public sector to license the use and re-use of their information under a common open
licence.

It is designed to encourage use and re-use of information freely and flexibly, with only a few conditions.
