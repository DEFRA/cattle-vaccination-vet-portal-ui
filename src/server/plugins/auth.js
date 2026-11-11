import { randomBytes } from 'node:crypto'
import bell from '@hapi/bell'

import { config } from '#/config/config.js'
import { createEntraClient } from '#/server/common/helpers/auth/entra-client.js'
import { safeReturnPath } from '#/server/common/helpers/auth/safe-return-path.js'
import { authRoutes, signInLifetime } from '#/server/routes/auth/index.js'

export const authentication = {
  name: 'authentication',
  dependencies: ['@hapi/yar'],
  async register(server) {
    const settings = config.get('entra')
    const session = config.get('session')
    const client = await createEntraClient(
      settings,
      session,
      config.get('isProduction')
    )
    await server.register(bell)
    server.auth.strategy('entra', 'bell', {
      provider: {
        name: 'entra',
        protocol: 'oauth2',
        useParamsAuth: true,
        pkce: 'S256',
        auth: client.authorizationEndpoint,
        token: client.tokenEndpoint,
        scope: ['openid', 'profile', 'email']
      },
      clientId: settings.clientId,
      clientSecret: settings.clientSecret,
      password: settings.cookiePassword,
      cookie: 'bell-entra',
      ttl: signInLifetime,
      isSecure: new URL(settings.redirectUrl).protocol === 'https:',
      isSameSite: 'Lax',
      isHttpOnly: true,
      location: () => settings.redirectUrl,
      skipProfile: true,
      providerParams(request) {
        const nonce = randomBytes(32).toString('base64url')
        request.yar.set('pendingSignIn', {
          nonce,
          createdAt: Date.now(),
          returnTo: safeReturnPath(request.query.redirect)
        })
        return { nonce, response_mode: 'query' }
      }
    })
    server.auth.scheme('yar-session', () => ({
      authenticate(request, h) {
        const user = request.yar.get('user')
        if (
          typeof user?.id === 'string' &&
          user.id &&
          Number.isFinite(user.expiresAt) &&
          user.expiresAt > Date.now()
        ) {
          return h.authenticated({ credentials: user })
        }
        request.yar.clear('user')
        const returnTo = safeReturnPath(`${request.path}${request.url.search}`)
        return h
          .redirect(`/auth/sign-in?redirect=${encodeURIComponent(returnTo)}`)
          .code(303)
          .takeover()
      }
    }))
    server.auth.strategy('session', 'yar-session')
    server.route(authRoutes(client, session))
    server.ext('onPreResponse', (request, h) => {
      if (request.path.startsWith('/auth/')) {
        const response = request.response.isBoom
          ? request.response.output
          : request.response
        if (request.response.isBoom) {
          response.headers['cache-control'] = 'private, no-store'
          response.headers['referrer-policy'] = 'no-referrer'
        } else {
          response.header('cache-control', 'private, no-store')
          response.header('referrer-policy', 'no-referrer')
        }
      }
      return h.continue
    })
  }
}
