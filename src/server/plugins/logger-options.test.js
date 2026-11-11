import hapi from '@hapi/hapi'
import hapiPino from 'hapi-pino'
import { loggerOptions } from './logger-options.js'

test('Request logs omit OAuth query values, authorization headers and cookies in every environment', async () => {
  const entries = []
  const server = hapi.server()
  await server.register({
    plugin: hapiPino,
    options: {
      ...loggerOptions,
      enabled: true,
      transport: undefined,
      stream: { write: (entry) => entries.push(entry) }
    }
  })
  server.route({
    method: 'GET',
    path: '/auth/sign-in-oidc',
    handler: (_request, h) =>
      h.response('OK').header('set-cookie', 'session=RESPONSE_SECRET')
  })
  await server.initialize()
  await server.inject({
    url: '/auth/sign-in-oidc?code=CODE_SECRET&state=STATE_SECRET&error_description=ERROR_SECRET',
    headers: {
      authorization: 'Bearer TOKEN_SECRET',
      cookie: 'session=COOKIE_SECRET'
    }
  })
  await server.stop()
  const output = entries.join('')
  expect(output).toContain('/auth/sign-in-oidc')
  expect(output).not.toContain('SECRET')
})
