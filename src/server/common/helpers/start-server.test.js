import { vi } from 'vitest'

import { createServer } from '../../server.js'
import { config } from '#/config/config.js'
import { startServer } from './start-server.js'

vi.mock('../../server.js', () => ({
  createServer: vi.fn()
}))

describe('#startServer', () => {
  let server

  beforeEach(() => {
    server = {
      start: vi.fn().mockResolvedValue(undefined),
      logger: { info: vi.fn() }
    }
    vi.mocked(createServer).mockResolvedValue(server)
  })

  test('Should start the server, log startup and return it', async () => {
    await expect(startServer()).resolves.toBe(server)

    expect(createServer).toHaveBeenCalledOnce()
    expect(server.start).toHaveBeenCalledOnce()
    expect(server.logger.info).toHaveBeenCalledWith(
      'Server started successfully'
    )
    expect(server.logger.info).toHaveBeenCalledWith(
      `Access your frontend on http://localhost:${config.get('port')}`
    )
  })

  test('Should propagate server creation failures', async () => {
    const error = new Error('Server failed to create')
    vi.mocked(createServer).mockRejectedValue(error)

    await expect(startServer()).rejects.toBe(error)
    expect(server.start).not.toHaveBeenCalled()
    expect(server.logger.info).not.toHaveBeenCalled()
  })

  test('Should propagate startup failures without logging success', async () => {
    const error = new Error('Server failed to start')
    server.start.mockRejectedValue(error)

    await expect(startServer()).rejects.toBe(error)
    expect(server.logger.info).not.toHaveBeenCalled()
  })
})
