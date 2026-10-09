import { createServer } from '#/server/server.js'

describe('#crumb', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    server.route([
      {
        method: 'GET',
        path: '/csrf-test',
        handler(request) {
          return request.plugins.crumb
        }
      },
      {
        method: 'POST',
        path: '/csrf-test',
        handler() {
          return 'OK'
        }
      }
    ])
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should reject a POST request without a crumb', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/csrf-test'
    })

    expect(response.statusCode).toBe(403)
  })

  test('Should accept a POST request with a matching crumb and cookie', async () => {
    const getResponse = await server.inject({
      method: 'GET',
      url: '/csrf-test'
    })
    const crumbCookie = getResponse.headers['set-cookie'].find((value) =>
      value.startsWith('crumb=')
    )
    const cookie = crumbCookie.split(';')[0]
    const response = await server.inject({
      method: 'POST',
      url: '/csrf-test',
      headers: { cookie },
      payload: { crumb: getResponse.result }
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toBe('OK')
  })
})
