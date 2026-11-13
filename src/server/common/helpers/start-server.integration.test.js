import { config } from '#/config/config.js'
import { statusCodes } from '../constants/status-codes.js'
import { startServer } from './start-server.js'

describe('#startServer integration', () => {
  let server
  let originalPort
  let originalHost

  beforeEach(() => {
    originalPort = config.get('port')
    originalHost = config.get('host')
    config.set('port', 0)
    config.set('host', '127.0.0.1')
  })

  afterEach(async () => {
    try {
      if (server) {
        await server.stop({ timeout: 0 })
      }
    } finally {
      config.set('port', originalPort)
      config.set('host', originalHost)
    }
  })

  test('Should start the real application and serve health over HTTP', async () => {
    server = await startServer()

    expect(server.info.started).toBeGreaterThan(0)
    expect(server.info.port).toBeGreaterThan(0)

    const response = await fetch(
      `http://127.0.0.1:${server.info.port}/health`,
      { signal: AbortSignal.timeout(5000) }
    )

    expect(response.status).toBe(statusCodes.ok)
    await expect(response.json()).resolves.toEqual({ message: 'success' })
  })
})
