import { safeReturnPath } from '#/server/common/helpers/auth/safe-return-path.js'

export const signInLifetime = 10 * 60 * 1000

function authenticationFailed(request, h) {
  request.yar.clear('pendingSignIn')
  h.unstate('bell-entra')
  return h.redirect('/auth/sign-in-failed').code(303)
}

export function authRoutes(client, session) {
  return [
    {
      method: 'GET',
      path: '/auth/sign-in-failed',
      options: { auth: false },
      handler: (_request, h) => h.view('auth/failure', {}).code(401)
    },
    {
      method: 'GET',
      path: '/auth/sign-in',
      options: { auth: { strategy: 'entra', mode: 'try' } },
      handler: authenticationFailed
    },
    {
      method: 'GET',
      path: '/auth/sign-in-oidc',
      options: {
        auth: { strategy: 'entra', mode: 'try' },
        ext: {
          onPreAuth: {
            method(request, h) {
              const pending = request.yar.get('pendingSignIn')
              if (
                request.query.error ||
                !request.query.code ||
                !request.state['bell-entra'] ||
                !pending ||
                !Number.isFinite(pending.createdAt) ||
                pending.createdAt > Date.now() ||
                Date.now() - pending.createdAt >= signInLifetime
              ) {
                return authenticationFailed(request, h).takeover()
              }
              return h.continue
            }
          }
        }
      },
      async handler(request, h) {
        const pending = request.yar.get('pendingSignIn', true)
        if (
          !request.auth.isAuthenticated ||
          !pending ||
          !Number.isFinite(pending.createdAt) ||
          pending.createdAt > Date.now() ||
          Date.now() - pending.createdAt >= signInLifetime
        ) {
          return authenticationFailed(request, h)
        }
        let claims
        try {
          claims = await client.verify(
            request.auth.artifacts?.id_token,
            pending.nonce
          )
        } catch {
          request.logger?.warn('Entra sign-in verification failed')
          return authenticationFailed(request, h)
        }
        const expiresAt = Math.min(
          claims.exp * 1000,
          Date.now() + session.cache.ttl,
          Date.now() + session.cookie.ttl
        )
        await request.server.yar.revoke(request.yar.id)
        request.yar.reset()
        request.yar.set('user', {
          id: claims.sub,
          name: typeof claims.name === 'string' ? claims.name : '',
          expiresAt
        })
        return h.redirect(safeReturnPath(pending.returnTo)).code(303)
      }
    },
    {
      method: 'POST',
      path: '/auth/sign-out',
      options: { auth: false },
      async handler(request, h) {
        await request.server.yar.revoke(request.yar.id)
        request.yar.reset()
        h.unstate('bell-entra')
        return h.redirect('/').code(303)
      }
    }
  ]
}
