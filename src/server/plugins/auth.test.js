import hapi from '@hapi/hapi'
import yar from '@hapi/yar'
import crumb from '@hapi/crumb'
import { config } from '#/config/config.js'
import { authentication } from './auth.js'
import { safeReturnPath } from '#/server/common/helpers/auth/safe-return-path.js'

vi.mock('#/server/common/helpers/auth/entra-client.js', () => ({
  createEntraClient: vi.fn().mockResolvedValue({
    authorizationEndpoint:
      'https://login.microsoftonline.com/test/oauth2/v2.0/authorize',
    tokenEndpoint: 'https://login.microsoftonline.com/test/oauth2/v2.0/token',
    verify: vi.fn()
  })
}))

let server
const originalEntra = config.get('entra')

beforeAll(async () => {
  config.set('entra', {
    tenantId: '11111111-1111-1111-1111-111111111111',
    clientId: '22222222-2222-2222-2222-222222222222',
    clientSecret: 'test-secret',
    cookiePassword: 'a-test-bell-password-of-at-least-32-characters',
    redirectUrl: 'http://localhost:3000/auth/sign-in-oidc'
  })
  server = hapi.server()
  await server.register({
    plugin: yar,
    options: {
      maxCookieSize: 0,
      storeBlank: false,
      cookieOptions: {
        password: 'a-test-session-password-of-at-least-32-characters',
        isSecure: false,
        isHttpOnly: true,
        isSameSite: 'Lax'
      }
    }
  })
  await server.register({
    plugin: crumb,
    options: { cookieOptions: { isSecure: false } }
  })
  await server.register(authentication)
  server.route([
    {
      method: 'GET',
      path: '/work-orders',
      options: { auth: 'session' },
      handler: (request) => request.auth.credentials
    },
    { method: 'GET', path: '/', handler: () => 'public' },
    {
      method: 'GET',
      path: '/test-session',
      handler(request) {
        request.yar.set('user', {
          id: 'test-user',
          expiresAt: Date.now() + 60000
        })
        return { crumb: request.plugins.crumb }
      }
    }
  ])
  await server.initialize()
})

afterAll(async () => {
  config.set('entra', originalEntra)
  await server.stop()
})

function cookies(response) {
  return response.headers['set-cookie']
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

test('Redirects an anonymous work order request without protecting public pages', async () => {
  const response = await server.inject('/work-orders?lang=cy')
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe(
    '/auth/sign-in?redirect=%2Fwork-orders%3Flang%3Dcy'
  )
  expect((await server.inject('/')).statusCode).toBe(200)
})

test('Authenticates using the cache-backed Yar session', async () => {
  const login = await server.inject('/test-session')
  const response = await server.inject({
    url: '/work-orders',
    headers: { cookie: cookies(login) }
  })
  expect(response.statusCode).toBe(200)
  expect(response.result.id).toBe('test-user')
})

test('Starts Bell with state, nonce, PKCE and a fixed callback URL', async () => {
  const response = await server.inject(
    '/auth/sign-in?redirect=%2Fwork-orders%3Flang%3Dcy'
  )
  expect(response.statusCode).toBe(302)
  const location = new URL(response.headers.location)
  expect(location.searchParams.get('redirect_uri')).toBe(
    'http://localhost:3000/auth/sign-in-oidc'
  )
  expect(location.searchParams.get('scope')).toBe('openid profile email')
  expect(location.searchParams.get('state')).toBeTruthy()
  expect(location.searchParams.get('nonce')).toBeTruthy()
  expect(location.searchParams.get('code_challenge_method')).toBe('S256')
  expect(location.searchParams.get('code_challenge')).toBeTruthy()
  expect(response.headers['cache-control']).toBe('private, no-store')
  expect(response.headers['referrer-policy']).toBe('no-referrer')
  expect(
    response.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('bell-entra=')
    )
  ).toMatch(/HttpOnly; SameSite=Lax/)
})

test('Sign-out requires Crumb and revokes an old session cookie', async () => {
  const login = await server.inject('/test-session')
  const cookie = cookies(login)
  for (const payload of [{}, { crumb: 'invalid' }]) {
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/auth/sign-out',
          headers: { cookie },
          payload
        })
      ).statusCode
    ).toBe(403)
  }
  expect(
    (await server.inject({ url: '/work-orders', headers: { cookie } }))
      .statusCode
  ).toBe(200)
  const response = await server.inject({
    method: 'POST',
    url: '/auth/sign-out',
    headers: { cookie },
    payload: { crumb: login.result.crumb }
  })
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe('/')
  expect(
    (await server.inject({ url: '/work-orders', headers: { cookie } }))
      .statusCode
  ).toBe(303)
  expect((await server.inject('/auth/sign-out')).statusCode).toBe(404)
})

test.each([
  '//evil.com',
  '/\\evil.com',
  'https://evil.com',
  '/about',
  '/work-orders/%2f%2fevil.com',
  '/work-orders/%255c',
  '/work-orders\r\nlocation:evil'
])('Rejects unsafe return URL %s', (value) => {
  expect(safeReturnPath(value)).toBe('/work-orders')
})

test('Preserves encoded work order identifiers and safe language queries', () => {
  expect(safeReturnPath('/work-orders/CV%20WorkOrder%202?lang=cy')).toBe(
    '/work-orders/CV%20WorkOrder%202?lang=cy'
  )
})
