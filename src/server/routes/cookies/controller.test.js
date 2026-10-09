import { load } from 'cheerio'

import { createServer } from '#/server/server.js'

describe('#cookiesController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test.each([
    [
      'en',
      'Cookies',
      'Protects forms against cross-site request forgery.',
      '1 year'
    ],
    [
      'cy',
      'Cwcis',
      'Yn diogelu ffurflenni rhag ffugio ceisiadau traws-safle.',
      '1 flwyddyn'
    ]
  ])(
    'Should localize the generated cookie page in %s',
    async (language, title, purpose, expiry) => {
      const response = await server.inject({
        url: `/cookies?lang=${language}`,
        headers: { 'accept-language': language === 'en' ? 'cy' : 'en' }
      })
      const $ = load(response.result)
      const settingsForm = $('main form')
      const rows = $('main .govuk-table__row').text()

      expect(response.statusCode).toBe(200)
      expect($('html').attr('lang')).toBe(language)
      expect($('h1').text()).toBe(title)
      expect($('title').text()).toContain(title)
      expect($('.govuk-footer a[href="/cookies"]').text().trim()).toBe(title)
      expect(rows).toContain('govuk_analytics_consent')
      expect(rows).toContain('crumb')
      expect(rows).toContain('i18next')
      expect(rows).toContain(purpose)
      expect(rows).toContain(expiry)
      expect(settingsForm.attr('action')).toBe(
        '/govuk-analytics-consent/consent'
      )
      expect(settingsForm.find('input[name="crumb"]').val()).toBeTruthy()
      expect(settingsForm.find('input[name="returnUrl"]').val()).toBe(
        `/cookies?lang=${language}`
      )
      expect(response.headers['cache-control']).toBe('private, no-store')
      expect(response.result).not.toContain('govuk-analytics-consent.cookies.')
    }
  )

  test.each(['yes', 'no'])(
    'Should save and read back cookie settings (%s) without JavaScript',
    async (choice) => {
      const page = await server.inject('/cookies?lang=cy&returnUrl=%2Fabout')
      const $ = load(page.result)
      const form = $('main form')
      const fields = Object.fromEntries(
        form
          .find('input[type="hidden"]')
          .map((_index, element) => [
            [$(element).attr('name'), $(element).val()]
          ])
          .get()
      )
      const cookies = page.headers['set-cookie'].map(
        (value) => value.split(';')[0]
      )
      const response = await server.inject({
        method: 'POST',
        url: form.attr('action'),
        headers: {
          cookie: cookies.join('; '),
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: new URLSearchParams({
          ...fields,
          'cookies[analytics]': choice
        }).toString()
      })

      expect(response.statusCode).toBe(303)
      const redirect = new URL(response.headers.location, 'http://localhost')
      expect(redirect.pathname).toBe('/cookies')
      expect(Object.fromEntries(redirect.searchParams)).toEqual({
        lang: 'cy',
        returnUrl: '/about',
        'cookies-updated': 'true'
      })
      const consentCookie = response.headers['set-cookie'].find((value) =>
        value.startsWith('govuk_analytics_consent=')
      )
      const saved = await server.inject({
        url: response.headers.location,
        headers: {
          cookie: [...cookies, consentCookie.split(';')[0]].join('; ')
        }
      })
      const $saved = load(saved.result)

      expect(saved.statusCode).toBe(200)
      expect($saved('.govuk-notification-banner--success').text()).toContain(
        'Rydych chi wedi gosod eich dewisiadau cwcis.'
      )
      expect($saved('.govuk-notification-banner__link').attr('href')).toBe(
        '/about'
      )
      expect($saved('main input[type="radio"]:checked').val()).toBe(choice)
      expect($saved('.govuk-cookie-banner')).toHaveLength(0)
      expect([saved.headers['set-cookie']].flat().join(';')).not.toContain(
        'crumb=;'
      )
      expect([saved.headers['set-cookie']].flat().join(';')).not.toContain(
        'i18next=;'
      )
    }
  )

  test('Should use the remembered i18next language rather than the browser language', async () => {
    const response = await server.inject({
      url: '/cookies',
      headers: { cookie: 'i18next=cy', 'accept-language': 'en' }
    })
    const $ = load(response.result)

    expect($('h1').text()).toBe('Cwcis')
    expect($('.govuk-cookie-banner__heading').text()).toBe(
      'Cwcis ar Porth Milfeddygon TB Buchol'
    )
    expect($('main').text()).toContain('Mae Porth Milfeddygon TB Buchol')
    expect($('main legend').text()).toBe(
      'Ydych chi eisiau derbyn cwcis dadansoddi?'
    )
    expect($('main').text()).not.toContain('1 year')
  })
})
