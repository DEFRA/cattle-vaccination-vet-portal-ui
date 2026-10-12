import { config } from '#/config/config.js'
import { clearServiceTokenCache, getServiceToken } from './service-token.js'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))

vi.mock('@aws-sdk/client-sts', () => ({
  STSClient: vi.fn(function STSClient() {
    this.send = send
  }),
  GetWebIdentityTokenCommand: vi.fn(function GetWebIdentityTokenCommand(input) {
    this.input = input
  })
}))

describe('#getServiceToken', () => {
  beforeEach(() => {
    clearServiceTokenCache()
    config.set('serviceAuth.audience', 'cattle-vaccination-backend')
    config.set('serviceAuth.tokenDurationSeconds', 300)
    send.mockResolvedValue({ WebIdentityToken: 'signed-token' })
  })

  test('Should request an RS256 token for the backend audience', async () => {
    const { GetWebIdentityTokenCommand } = await import('@aws-sdk/client-sts')

    await expect(getServiceToken()).resolves.toBe('signed-token')

    expect(GetWebIdentityTokenCommand).toHaveBeenCalledWith({
      Audience: ['cattle-vaccination-backend'],
      DurationSeconds: 300,
      SigningAlgorithm: 'RS256'
    })
  })

  test('Should reuse the cached token', async () => {
    await getServiceToken()
    await getServiceToken()

    expect(send).toHaveBeenCalledTimes(1)
  })
})
