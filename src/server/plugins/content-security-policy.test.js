import { createServer } from '#/server/server.js'
import { load } from 'cheerio'
import { consent } from './cookie-consent.js'

describe('#contentSecurityPolicy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should set the CSP policy header', async () => {
    const resp = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(resp.headers['content-security-policy']).toBeDefined()
  })

  test('Should authorize consent and GOV.UK scripts with a per-response nonce', async () => {
    const response = await server.inject('/')
    const policy = response.headers['content-security-policy']
    const nonce = policy.match(/'nonce-([^']+)'/)[1]
    const $ = load(response.result)
    const inlineScripts = $('script:not([src])')

    expect(inlineScripts.length).toBeGreaterThan(0)
    inlineScripts.each((_index, script) => {
      expect($(script).attr('nonce')).toBe(nonce)
    })
    expect(
      $('script[data-module="govuk-analytics-consent"]').attr('nonce')
    ).toBe(nonce)
    expect(policy).toContain("form-action 'self'")
    expect(policy).not.toContain("'unsafe-inline'")
    for (const source of consent.csp['script-src']) {
      expect(policy).toContain(source)
    }
    const nextResponse = await server.inject('/')
    expect(nextResponse.headers['content-security-policy']).not.toContain(
      `'nonce-${nonce}'`
    )
  })
})
