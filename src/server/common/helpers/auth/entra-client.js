import { createRemoteJWKSet, jwtVerify } from 'jose'

const microsoftOrigin = 'https://login.microsoftonline.com'
const identifierPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateEntraSettings(settings, session, isProduction) {
  if (
    !identifierPattern.test(settings.tenantId) ||
    !identifierPattern.test(settings.clientId)
  ) {
    throw new Error('ENTRA_TENANT_ID and ENTRA_CLIENT_ID must be UUIDs')
  }
  if (
    !settings.clientSecret?.trim() ||
    typeof settings.cookiePassword !== 'string' ||
    settings.cookiePassword.length < 32
  ) {
    throw new Error(
      'ENTRA_CLIENT_SECRET and ENTRA_COOKIE_PASSWORD (at least 32 characters) are required'
    )
  }
  if (
    session.cookie.password.length < 32 ||
    session.cookie.password ===
      'the-password-must-be-at-least-32-characters-long'
  ) {
    throw new Error(
      'Set SESSION_COOKIE_PASSWORD to a random value of at least 32 characters'
    )
  }
  const redirect = new URL(settings.redirectUrl)
  const localHttp =
    redirect.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(redirect.hostname)
  if (
    redirect.username ||
    redirect.password ||
    redirect.search ||
    redirect.hash ||
    redirect.pathname !== '/auth/sign-in-oidc' ||
    (redirect.protocol !== 'https:' && (!localHttp || isProduction)) ||
    (redirect.protocol === 'https:' && !session.cookie.secure) ||
    (isProduction && !session.cookie.secure)
  ) {
    throw new Error(
      'ENTRA_REDIRECT_URL must use HTTPS and secure session cookies, or loopback HTTP for local development'
    )
  }
  if (
    ![session.cache.ttl, session.cookie.ttl].every(
      (ttl) => Number.isFinite(ttl) && ttl > 0
    )
  ) {
    throw new Error('Session cache and cookie TTLs must be positive')
  }
}

export async function verifyIdToken(token, keys, settings, nonce) {
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ['RS256'],
    issuer: `${microsoftOrigin}/${settings.tenantId}/v2.0`,
    audience: settings.clientId,
    requiredClaims: ['sub', 'iat', 'exp', 'nonce', 'tid'],
    maxTokenAge: '10 minutes'
  })
  if (
    typeof payload.sub !== 'string' ||
    !payload.sub ||
    !nonce ||
    payload.nonce !== nonce ||
    payload.tid !== settings.tenantId ||
    (payload.azp !== undefined && payload.azp !== settings.clientId) ||
    (Array.isArray(payload.aud) &&
      payload.aud.length > 1 &&
      payload.azp !== settings.clientId)
  ) {
    throw new Error('Invalid Entra identity claims')
  }
  return payload
}

export async function createEntraClient(settings, session, isProduction) {
  validateEntraSettings(settings, session, isProduction)
  const authority = `${microsoftOrigin}/${settings.tenantId}`
  const response = await fetch(
    `${authority}/v2.0/.well-known/openid-configuration`,
    {
      signal: AbortSignal.timeout(10000),
      redirect: 'error'
    }
  )
  if (!response.ok) {
    throw new Error('Unable to load Entra OpenID configuration')
  }
  const discovery = await response.json()
  const keysUrl = new URL(discovery.jwks_uri)
  if (
    discovery.issuer !== `${authority}/v2.0` ||
    discovery.authorization_endpoint !== `${authority}/oauth2/v2.0/authorize` ||
    discovery.token_endpoint !== `${authority}/oauth2/v2.0/token` ||
    keysUrl.origin !== microsoftOrigin ||
    keysUrl.username ||
    keysUrl.password ||
    keysUrl.hash
  ) {
    throw new Error('Unexpected Entra OpenID configuration')
  }
  const keys = createRemoteJWKSet(keysUrl, { timeoutDuration: 10000 })
  return {
    authorizationEndpoint: discovery.authorization_endpoint,
    tokenEndpoint: discovery.token_endpoint,
    verify: (token, nonce) => verifyIdToken(token, keys, settings, nonce)
  }
}
