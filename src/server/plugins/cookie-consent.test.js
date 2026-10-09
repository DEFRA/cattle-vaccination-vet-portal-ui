import { load } from 'cheerio'

import { createServer } from '#/server/server.js'

describe('#cookieConsent', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should render one banner with a CSRF token and serve its script', async () => {
    const response = await server.inject('/')
    const $ = load(response.result)
    const banner = $('.govuk-cookie-banner')
    const crumbCookie = response.headers['set-cookie'].find((cookie) =>
      cookie.startsWith('crumb=')
    )

    expect(banner).toHaveLength(1)
    expect(banner.find('input[name="crumb"]').val()).toBe(
      crumbCookie.split(';')[0].slice('crumb='.length)
    )
    expect(banner.find('form').attr('action')).toBe(
      '/govuk-analytics-consent/consent'
    )
    expect(banner.find('a').first().attr('href')).toBe('/cookies?returnUrl=%2F')
    const scriptResponse = await server.inject(
      $('script[data-module="govuk-analytics-consent"]').attr('src')
    )
    expect(scriptResponse.statusCode).toBe(200)
    expect(scriptResponse.headers['content-type']).toContain('javascript')
  })

  test.each([
    ['accept-all', true],
    ['reject-all', false]
  ])(
    'Should persist the banner choice %s without JavaScript',
    async (preference, accepted) => {
      const page = await server.inject('/?lang=cy')
      const $ = load(page.result)
      const cookie = page.headers['set-cookie']
        .map((value) => value.split(';')[0])
        .join('; ')
      const response = await server.inject({
        method: 'POST',
        url: $('.govuk-cookie-banner form').attr('action'),
        headers: {
          cookie,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: new URLSearchParams({
          crumb: $('.govuk-cookie-banner input[name="crumb"]').val(),
          returnUrl: $('.govuk-cookie-banner input[name="returnUrl"]').val(),
          preference
        }).toString()
      })
      const consentCookie = response.headers['set-cookie'].find((value) =>
        value.startsWith('govuk_analytics_consent=')
      )
      const state = JSON.parse(
        decodeURIComponent(consentCookie.split(';')[0].split('=')[1])
      )

      expect(response.statusCode).toBe(303)
      expect(response.headers.location).toBe('/?lang=cy')
      expect(state.categories.analytics).toBe(accepted)
      expect(consentCookie).toContain('SameSite=Lax')
      expect(consentCookie).toContain('Max-Age=31536000')
      expect(response.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('i18next=cy')])
      )
      const remembered = await server.inject({
        url: response.headers.location,
        headers: { cookie: `${cookie}; ${consentCookie.split(';')[0]}` }
      })
      expect(load(remembered.result)('.govuk-cookie-banner')).toHaveLength(0)
      expect(remembered.result).toContain('<html lang="cy"')
    }
  )

  test.each([undefined, 'invalid-token'])(
    'Should reject consent submissions with a missing or invalid crumb (%s)',
    async (crumb) => {
      const page = await server.inject('/')
      const cookie = page.headers['set-cookie']
        .map((value) => value.split(';')[0])
        .join('; ')
      const payload = new URLSearchParams({ preference: 'accept-all' })
      if (crumb) {
        payload.set('crumb', crumb)
      }
      const response = await server.inject({
        method: 'POST',
        url: '/govuk-analytics-consent/consent',
        headers: {
          cookie,
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: payload.toString()
      })

      expect(response.statusCode).toBe(403)
      expect([response.headers['set-cookie']].flat().join(';')).not.toContain(
        'govuk_analytics_consent='
      )
    }
  )
})
