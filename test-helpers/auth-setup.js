import { vi } from 'vitest'

process.env.ENTRA_TENANT_ID = '11111111-1111-1111-1111-111111111111'
process.env.ENTRA_CLIENT_ID = '22222222-2222-2222-2222-222222222222'
process.env.ENTRA_CLIENT_SECRET = 'test-client-secret'
process.env.ENTRA_REDIRECT_URL = 'http://localhost:3000/auth/sign-in-oidc'
process.env.ENTRA_COOKIE_PASSWORD =
  'a-test-bell-password-of-at-least-32-characters'
process.env.SESSION_COOKIE_PASSWORD =
  'a-test-session-password-of-at-least-32-characters'

vi.doMock(
  '#/server/common/helpers/auth/entra-client.js',
  async (importOriginal) => {
    const actual = await importOriginal()
    return {
      ...actual,
      createEntraClient: vi.fn(async (settings, session, isProduction) => {
        actual.validateEntraSettings(settings, session, isProduction)
        const authority = `https://login.microsoftonline.com/${settings.tenantId}/oauth2/v2.0`
        return {
          authorizationEndpoint: `${authority}/authorize`,
          tokenEndpoint: `${authority}/token`,
          verify: vi.fn()
        }
      })
    }
  }
)
