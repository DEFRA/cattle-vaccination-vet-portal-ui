import { config } from '#/config/config.js'
import { backendRequest, getBackendAuthHeaders } from './backend-client.js'
import { clearServiceTokenCache } from './service-token.js'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))

vi.mock('@aws-sdk/client-sts', () => ({
  STSClient: vi.fn(function STSClient() {
    this.send = send
  }),
  GetWebIdentityTokenCommand: vi.fn(function GetWebIdentityTokenCommand(input) {
    this.input = input
  })
}))

describe('#backend client', () => {
  beforeEach(() => {
    clearServiceTokenCache()
    config.set('serviceAuth.enabled', false)
    config.set('backend.baseUrl', 'http://127.0.0.1:3002')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: 'success' })
      })
    )
  })

  afterEach(() => {
    config.set('serviceAuth.enabled', false)
    vi.unstubAllGlobals()
  })

  test('Should call the backend without an auth header when service auth is off', async () => {
    await expect(getBackendAuthHeaders()).resolves.toEqual({})

    await backendRequest('/health')

    expect(fetch).toHaveBeenCalledWith('http://127.0.0.1:3002/health', {
      headers: {}
    })
  })

  test('Should send the service token when service auth is on', async () => {
    config.set('serviceAuth.enabled', true)
    send.mockResolvedValue({ WebIdentityToken: 'signed-token' })

    await expect(getBackendAuthHeaders()).resolves.toEqual({
      authorization: 'Bearer signed-token'
    })
  })

  test('Should throw when the backend response is not ok', async () => {
    fetch.mockResolvedValue({ ok: false, status: 502 })

    await expect(backendRequest('/health')).rejects.toMatchObject({
      message: 'Backend request failed with status 502',
      statusCode: 502
    })
  })
})
