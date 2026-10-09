import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { load } from 'cheerio'

describe('#homeController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should provide expected response', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(result).toEqual(expect.stringContaining('Home |'))
    expect(statusCode).toBe(statusCodes.ok)

    const $page = load(result)

    expect($page('html').attr('lang')).toBe('en')
    expect($page('.govuk-language-navigation__text').text()).toBe('English')
    expect($page('.govuk-language-navigation__link').attr('href')).toBe(
      '/?lang=cy'
    )
  })

  test('Should set and remember the selected language', async () => {
    const welshResponse = await server.inject({
      method: 'GET',
      url: '/?lang=cy',
      headers: {
        cookie: 'i18next=en',
        'accept-language': 'en'
      }
    })

    const $welshPage = load(welshResponse.result)
    const $languageNavigation = $welshPage(
      '.govuk-service-navigation .govuk-language-navigation'
    )

    expect($welshPage('html').attr('lang')).toBe('cy')
    expect($welshPage('h1').text()).toContain('Hafan')
    expect($languageNavigation).toHaveLength(1)
    expect($languageNavigation.attr('aria-label')).toBe('Dewiswch iaith')
    expect($welshPage('.govuk-language-navigation__text').text()).toBe(
      'Cymraeg'
    )
    expect($welshPage('.govuk-language-navigation__link').attr('href')).toBe(
      '/?lang=en'
    )
    expect(welshResponse.headers['set-cookie']).toEqual(
      expect.arrayContaining([
        expect.stringContaining('i18next=cy'),
        expect.stringContaining('crumb=')
      ])
    )

    const rememberedResponse = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        cookie: 'i18next=cy',
        'accept-language': 'en'
      }
    })

    expect(rememberedResponse.result).toContain('<html lang="cy"')
    expect(rememberedResponse.result).toContain('Hafan')
  })
})
