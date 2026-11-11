import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import {
  createEntraClient,
  validateEntraSettings,
  verifyIdToken
} from './entra-client.js'

vi.unmock('./entra-client.js')

const settings = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  clientId: '22222222-2222-2222-2222-222222222222',
  clientSecret: 'test-secret',
  cookiePassword: 'a-test-bell-password-of-at-least-32-characters',
  redirectUrl: 'http://localhost:3000/auth/sign-in-oidc'
}
const session = {
  cache: { ttl: 14400000 },
  cookie: {
    password: 'a-test-session-password-of-at-least-32-characters',
    secure: false,
    ttl: 14400000
  }
}
const authority = `https://login.microsoftonline.com/${settings.tenantId}`
let privateKey
let keys

beforeAll(async () => {
  const keyPair = await generateKeyPair('RS256')
  privateKey = keyPair.privateKey
  keys = createLocalJWKSet({
    keys: [
      { ...(await exportJWK(keyPair.publicKey)), kid: 'test-key', alg: 'RS256' }
    ]
  })
})

afterEach(() => vi.unstubAllGlobals())

async function signToken(claims = {}) {
  return new SignJWT({
    nonce: 'expected-nonce',
    tid: settings.tenantId,
    ...claims
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(claims.iss ?? `${authority}/v2.0`)
    .setAudience(claims.aud ?? settings.clientId)
    .setSubject('test-user')
    .setIssuedAt()
    .setExpirationTime(claims.exp ?? '1 hour')
    .sign(privateKey)
}

test('Accepts a signed ID token intended for this tenant, client and sign-in', async () => {
  const claims = await verifyIdToken(
    await signToken(),
    keys,
    settings,
    'expected-nonce'
  )
  expect(claims.sub).toBe('test-user')
})

test.each([
  { nonce: 'wrong' },
  { tid: 'other-tenant' },
  { aud: 'other-app' },
  { iss: 'https://example.com' },
  { exp: 1 },
  { nbf: 9999999999 },
  { azp: 'other-app' },
  { aud: [settings.clientId, 'other-app'] }
])('Rejects invalid identity claims: %j', async (claims) => {
  await expect(
    verifyIdToken(await signToken(claims), keys, settings, 'expected-nonce')
  ).rejects.toThrow()
})

test('Rejects a token signed by another key', async () => {
  const otherKeys = await generateKeyPair('RS256')
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .sign(otherKeys.privateKey)
  await expect(
    verifyIdToken(token, keys, settings, 'expected-nonce')
  ).rejects.toThrow()
})

test.each(['sub', 'iat', 'exp', 'nonce', 'tid'])(
  'Rejects missing required claim %s',
  async (claim) => {
    const claims = {
      sub: 'test-user',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      nonce: 'expected-nonce',
      tid: settings.tenantId,
      iss: `${authority}/v2.0`,
      aud: settings.clientId
    }
    delete claims[claim]
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .sign(privateKey)
    await expect(
      verifyIdToken(token, keys, settings, 'expected-nonce')
    ).rejects.toThrow()
  }
)

test.each(['clientSecret', 'cookiePassword', 'tenantId', 'clientId'])(
  'Requires valid %s configuration',
  (name) => {
    expect(() =>
      validateEntraSettings({ ...settings, [name]: '' }, session, false)
    ).toThrow()
  }
)

test.each([
  'https://example.com/auth/sign-in-oidc?extra=1',
  'http://example.com/auth/sign-in-oidc',
  'https://example.com/wrong'
])('Rejects unsafe callback configuration %s', (redirectUrl) => {
  expect(() =>
    validateEntraSettings({ ...settings, redirectUrl }, session, false)
  ).toThrow()
})

test('Rejects insecure production cookies and default session passwords', () => {
  expect(() => validateEntraSettings(settings, session, true)).toThrow()
  expect(() =>
    validateEntraSettings(
      settings,
      {
        ...session,
        cookie: {
          ...session.cookie,
          password: 'the-password-must-be-at-least-32-characters-long'
        }
      },
      false
    )
  ).toThrow()
})

test('Loads tenant discovery once when creating the client', async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      issuer: `${authority}/v2.0`,
      authorization_endpoint: `${authority}/oauth2/v2.0/authorize`,
      token_endpoint: `${authority}/oauth2/v2.0/token`,
      jwks_uri: 'https://login.microsoftonline.com/common/discovery/v2.0/keys'
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  const client = await createEntraClient(settings, session, false)
  expect(client.authorizationEndpoint).toBe(
    `${authority}/oauth2/v2.0/authorize`
  )
  expect(fetchMock).toHaveBeenCalledOnce()
})

test('Fails closed on unavailable or untrusted discovery', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
  await expect(createEntraClient(settings, session, false)).rejects.toThrow(
    'Unable to load'
  )
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jwks_uri: 'https://example.com/keys' })
    })
  )
  await expect(createEntraClient(settings, session, false)).rejects.toThrow(
    'Unexpected Entra'
  )
})
