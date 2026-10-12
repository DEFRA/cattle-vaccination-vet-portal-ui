import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { backendRequest } from '#/server/common/helpers/backend-client.js'

vi.mock('#/server/common/helpers/backend-client.js', () => ({
  backendRequest: vi.fn()
}))

describe('#backendHealthController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should return the backend health payload', async () => {
    backendRequest.mockResolvedValue({ message: 'success' })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/backend-health'
    })

    expect(backendRequest).toHaveBeenCalledWith('/health')
    expect(result).toEqual({ message: 'success' })
    expect(statusCode).toBe(statusCodes.ok)
  })
})
