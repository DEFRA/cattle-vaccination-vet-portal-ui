import hapi from '@hapi/hapi'
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { load } from 'cheerio'
import { createServer } from '#/server/server.js'
import { config } from '#/config/config.js'
import {
  createEntraClient,
  verifyIdToken
} from '#/server/common/helpers/auth/entra-client.js'
import { backendRequest } from '#/server/common/helpers/backend-client.js'

vi.mock('#/server/common/helpers/backend-client.js', () => ({
  backendRequest: vi.fn()
}))

let server
let tokenServer
let privateKey
let keys
let tokenNonce
let tokenClaims
let tokenPayload
let exchangeCount

function cookies(response) {
  return (response.headers['set-cookie'] ?? [])
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256')
  privateKey = keyPair.privateKey
  keys = createLocalJWKSet({
    keys: [
      {
        ...(await exportJWK(keyPair.publicKey)),
        alg: 'RS256',
        kid: 'login-test'
      }
    ]
  })
  tokenServer = hapi.server({ host: '127.0.0.1', port: 0 })
  tokenServer.route({
    method: 'POST',
    path: '/token',
    async handler(request) {
      tokenPayload = request.payload
      exchangeCount++
      const settings = config.get('entra')
      const token = await new SignJWT({
        nonce: tokenNonce,
        tid: settings.tenantId,
        name: 'Test vet',
        ...tokenClaims
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'login-test' })
        .setIssuer(
          `https://login.microsoftonline.com/${settings.tenantId}/v2.0`
        )
        .setAudience(settings.clientId)
        .setSubject('test-vet')
        .setIssuedAt()
        .setExpirationTime('1 hour')
        .sign(privateKey)
      return {
        access_token: 'unused-access-token',
        token_type: 'Bearer',
        expires_in: 3600,
        id_token: token
      }
    }
  })
  await tokenServer.start()
  createEntraClient.mockImplementation(async (settings) => ({
    authorizationEndpoint: `https://login.microsoftonline.com/${settings.tenantId}/oauth2/v2.0/authorize`,
    tokenEndpoint: `${tokenServer.info.uri}/token`,
    verify: (token, nonce) => verifyIdToken(token, keys, settings, nonce)
  }))
  server = await createServer()
  server.route([
    {
      method: 'GET',
      path: '/test-expired-session',
      handler(request) {
        request.yar.set('user', { id: 'expired', expiresAt: Date.now() - 1 })
        return 'OK'
      }
    },
    {
      method: 'GET',
      path: '/test-expired-login',
      handler(request) {
        const pending = request.yar.get('pendingSignIn')
        request.yar.set('pendingSignIn', {
          ...pending,
          createdAt: Date.now() - 600000
        })
        return 'OK'
      }
    },
    {
      method: 'GET',
      path: '/test-session-data',
      handler(request) {
        return {
          state: request.state[config.get('session.cache.name')],
          user: request.yar.get('user')
        }
      }
    }
  ])
  await server.initialize()
})

beforeEach(() => {
  tokenClaims = {}
  tokenPayload = null
  exchangeCount = 0
  backendRequest.mockResolvedValue([])
})

afterAll(async () => {
  await server?.stop({ timeout: 0 })
  await tokenServer?.stop({ timeout: 0 })
})

async function beginSignIn(redirect = '/work-orders?lang=cy') {
  const response = await server.inject(
    `/auth/sign-in?redirect=${encodeURIComponent(redirect)}`
  )
  const location = new URL(response.headers.location)
  tokenNonce = location.searchParams.get('nonce')
  return {
    cookie: cookies(response),
    state: location.searchParams.get('state'),
    response,
    location
  }
}

async function completeSignIn(start, state = start.state) {
  return server.inject({
    url: `/auth/sign-in-oidc?code=test-code&state=${encodeURIComponent(state)}`,
    headers: { cookie: start.cookie }
  })
}

test.each([
  ['GET', '/work-orders'],
  ['GET', '/work-orders/order-1'],
  ['GET', '/work-orders/order-1/work-lists/list-1'],
  ['POST', '/work-orders/order-1']
])(
  'Protects anonymous %s %s without contacting the backend',
  async (method, url) => {
    const response = await server.inject({ method, url })
    expect([303, 403]).toContain(response.statusCode)
    expect(backendRequest).not.toHaveBeenCalled()
  }
)

test('Completes Bell code exchange, verifies identity, renews session and returns to a safe deep link', async () => {
  const start = await beginSignIn('/work-orders?lang=cy')
  const callback = await completeSignIn(start)
  expect(callback.statusCode).toBe(303)
  expect(callback.headers.location).toBe('/work-orders?lang=cy')
  expect(tokenPayload).toMatchObject({
    grant_type: 'authorization_code',
    code: 'test-code',
    redirect_uri: config.get('entra.redirectUrl'),
    client_id: config.get('entra.clientId')
  })
  expect(tokenPayload.code_verifier).toBeTruthy()
  const cookie = cookies(callback)
  expect(cookie).not.toContain('unused-access-token')
  const stored = await server.inject({
    url: '/test-session-data',
    headers: { cookie }
  })
  expect(Object.keys(stored.result.state)).toEqual(['id'])
  expect(stored.result.user).toEqual({
    id: 'test-vet',
    name: 'Test vet',
    expiresAt: expect.any(Number)
  })
  expect(stored.result.user.expiresAt).toBeLessThanOrEqual(Date.now() + 3600000)
  const sessionCookie = callback.headers['set-cookie'].find((value) =>
    value.startsWith('session=')
  )
  expect(sessionCookie).toContain('HttpOnly')
  expect(sessionCookie).toContain('SameSite=Lax')
  const page = await server.inject({
    url: '/work-orders?lang=cy',
    headers: { cookie }
  })
  expect(page.statusCode).toBe(200)
  const form = load(page.result)('form[action="/auth/sign-out"]')
  expect(form.attr('method')).toBe('post')
  expect(form.find('button').text()).toBe('Allgofnodi')
  expect(form.find('input[name="crumb"]').val()).toBeTruthy()
  expect(
    (
      await server.inject({
        url: '/work-orders',
        headers: { cookie: start.cookie }
      })
    ).statusCode
  ).toBe(303)
  const replay = await completeSignIn(start)
  expect(replay.headers.location).toBe('/auth/sign-in-failed')
  expect(exchangeCount).toBe(1)
})

test('Sign-out form revokes access and remains available on public pages', async () => {
  const callback = await completeSignIn(await beginSignIn())
  const cookie = cookies(callback)
  const page = await server.inject({ url: '/', headers: { cookie } })
  const form = load(page.result)('form[action="/auth/sign-out"]')
  expect(form.find('button').text()).toBe('Sign out')
  for (const crumb of [undefined, 'invalid']) {
    const rejected = await server.inject({
      method: 'POST',
      url: '/auth/sign-out',
      headers: { cookie },
      payload: { crumb }
    })
    expect(rejected.statusCode).toBe(403)
  }
  const signedOut = await server.inject({
    method: 'POST',
    url: '/auth/sign-out',
    headers: { cookie },
    payload: { crumb: form.find('input[name="crumb"]').val() }
  })
  expect(signedOut.statusCode).toBe(303)
  expect(signedOut.headers.location).toBe('/')
  expect(
    (await server.inject({ url: '/work-orders', headers: { cookie } }))
      .statusCode
  ).toBe(303)
})

test('Rejects mismatched OAuth state before token exchange', async () => {
  const callback = await completeSignIn(await beginSignIn(), 'invalid-state')
  expect(callback.statusCode).toBe(303)
  expect(callback.headers.location).toBe('/auth/sign-in-failed')
  expect(exchangeCount).toBe(0)
  expect(callback.headers['cache-control']).toBe('private, no-store')
  expect(callback.headers['referrer-policy']).toBe('no-referrer')
})

test('Rejects a signed token with the wrong nonce', async () => {
  const start = await beginSignIn()
  tokenClaims = { nonce: 'wrong-nonce' }
  const response = await completeSignIn(start)
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe('/auth/sign-in-failed')
  expect(
    (
      await server.inject({
        url: '/work-orders',
        headers: { cookie: cookies(response) }
      })
    ).statusCode
  ).toBe(303)
})

test.each(['access_denied', 'server_error', 'interaction_required'])(
  'Handles Entra error %s without restarting sign-in or leaking error details',
  async (error) => {
    const start = await beginSignIn()
    const response = await server.inject({
      url: `/auth/sign-in-oidc?error=${error}&error_description=SECRET`,
      headers: { cookie: start.cookie }
    })
    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe('/auth/sign-in-failed')
    const failure = await server.inject(response.headers.location)
    expect(failure.statusCode).toBe(401)
    expect(failure.result).not.toContain('SECRET')
    expect(failure.result).toContain('Try signing in again')
    expect(exchangeCount).toBe(0)
  }
)

test('Rejects direct or cookieless callbacks', async () => {
  for (const url of [
    '/auth/sign-in-oidc',
    '/auth/sign-in-oidc?code=invalid&state=invalid'
  ]) {
    expect((await server.inject(url)).headers.location).toBe(
      '/auth/sign-in-failed'
    )
  }
})

test('Never redirects to an external return URL', async () => {
  const response = await completeSignIn(await beginSignIn('//evil.example'))
  expect(response.headers.location).toBe('/work-orders')
})

test('Rejects expired authentication sessions', async () => {
  const expired = await server.inject('/test-expired-session')
  const response = await server.inject({
    url: '/work-orders',
    headers: { cookie: cookies(expired) }
  })
  expect(response.statusCode).toBe(303)
  expect(backendRequest).not.toHaveBeenCalled()
})

test('Rejects expired pending sign-ins before code exchange', async () => {
  const start = await beginSignIn()
  const expired = await server.inject({
    url: '/test-expired-login',
    headers: { cookie: start.cookie }
  })
  const updatedCookie = cookies(expired)
    .split('; ')
    .find((value) => value.startsWith('session='))
  start.cookie = start.cookie
    .split('; ')
    .filter((value) => !value.startsWith('session='))
    .concat(updatedCookie)
    .join('; ')
  expect((await completeSignIn(start)).headers.location).toBe(
    '/auth/sign-in-failed'
  )
  expect(exchangeCount).toBe(0)
})

test('Authenticated work-list creation still requires a valid Crumb', async () => {
  const callback = await completeSignIn(await beginSignIn())
  const cookie = cookies(callback)
  const page = await server.inject({ url: '/', headers: { cookie } })
  const pageCookies = cookies(page)
  const allCookies = `${cookie}; ${pageCookies}`
  const token = load(page.result)(
    'form[action="/auth/sign-out"] input[name="crumb"]'
  ).val()
  for (const crumb of [undefined, 'wrong']) {
    const response = await server.inject({
      method: 'POST',
      url: '/work-orders/order-1',
      headers: { cookie: allCookies },
      payload: { crumb }
    })
    expect(response.statusCode).toBe(403)
  }
  expect(backendRequest).not.toHaveBeenCalled()
  backendRequest.mockResolvedValue({ id: 'list-1' })
  const response = await server.inject({
    method: 'POST',
    url: '/work-orders/order-1',
    headers: { cookie: allCookies },
    payload: { crumb: token }
  })
  expect(response.statusCode).toBe(303)
  expect(response.headers.location).toBe(
    '/work-orders/order-1/work-lists/list-1'
  )
  expect(backendRequest).toHaveBeenCalledWith(
    '/workorders/order-1/work-lists',
    { method: 'POST' }
  )
})

test('Every registered work-order route uses session authentication', () => {
  const routes = server
    .table()
    .filter((route) => route.path.startsWith('/work-orders'))
  expect(routes).toHaveLength(4)
  expect(
    routes.every((route) => route.settings.auth.strategies.includes('session'))
  ).toBe(true)
})
