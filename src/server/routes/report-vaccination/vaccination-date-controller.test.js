import { load } from 'cheerio'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { backendRequest } from '#/server/common/helpers/backend-client.js'
import { validateVaccinationDate } from './vaccination-date-controller.js'

vi.mock('#/server/common/helpers/backend-client.js', () => ({
  backendRequest: vi.fn()
}))

const pageUrl =
  '/work-orders/CV%20WorkOrder%202/work-lists/a0W000000000002/report-vaccination/date'
const otherWorkListPageUrl =
  '/work-orders/CV%20WorkOrder%202/work-lists/a0W000000000003/report-vaccination/date'
const workOrder = {
  id: 'CV WorkOrder 2',
  cph: {
    locationName: 'Tarbh Farm',
    cphCode: '40/715/9200'
  }
}

function cookiesFrom(...responses) {
  const cookies = new Map()

  for (const response of responses) {
    for (const header of response.headers['set-cookie'] ?? []) {
      const cookie = header.split(';')[0]
      const separator = cookie.indexOf('=')
      cookies.set(cookie.slice(0, separator), cookie)
    }
  }

  return [...cookies.values()].join('; ')
}

function datePayload(values) {
  return {
    'vaccination-date-day': values.day ?? '',
    'vaccination-date-month': values.month ?? '',
    'vaccination-date-year': values.year ?? '',
    action: 'continue'
  }
}

function formPayload($page, values = {}, crumb) {
  const payload = datePayload(values)

  if (crumb !== null) {
    payload.crumb = crumb ?? $page('input[name="crumb"]').val()
  }

  return new URLSearchParams(payload).toString()
}

async function submitDate(server, page, values = {}, crumb) {
  return server.inject({
    method: 'POST',
    url: pageUrl,
    headers: {
      cookie: cookiesFrom(page),
      'content-type': 'application/x-www-form-urlencoded'
    },
    payload: formPayload(load(page.result), values, crumb)
  })
}

describe('#validateVaccinationDate', () => {
  const today = new Date(2026, 10, 19)

  test.each([
    ['1', '1', '2026', '2026-01-01'],
    ['01', '01', '2026', '2026-01-01'],
    ['5', 'Jan', '2026', '2026-01-05'],
    ['5', 'january', '2026', '2026-01-05'],
    ['5', 'JANUARY', '2026', '2026-01-05'],
    ['5', 'Ionawr', '2026', '2026-01-05'],
    ['19', '11', '2026', '2026-11-19']
  ])('accepts day %s, month %s and year %s', (day, month, year, expected) => {
    expect(
      validateVaccinationDate(datePayload({ day, month, year }), today)
    ).toEqual({ value: expected })
  })

  test.each([
    [
      { day: '  ', month: '', year: '' },
      { errorKey: 'empty', errorFields: ['day', 'month', 'year'] }
    ],
    [
      { day: '', month: '1', year: '2026' },
      { errorKey: 'missingDay', errorFields: ['day'] }
    ],
    [
      { day: '1', month: 'Ja', year: '26' },
      { errorKey: 'missingMonthYear', errorFields: ['month', 'year'] }
    ],
    [
      { day: '32', month: '1', year: '2026' },
      { errorKey: 'invalid', errorFields: ['day'] }
    ],
    [
      { day: '1', month: 'Smarch', year: '2026' },
      { errorKey: 'invalid', errorFields: ['month'] }
    ],
    [
      { day: '32', month: '13', year: '2026' },
      { errorKey: 'invalid', errorFields: ['day', 'month', 'year'] }
    ],
    [
      { day: '31', month: 'February', year: '2026' },
      { errorKey: 'invalid', errorFields: ['day', 'month', 'year'] }
    ],
    [
      { day: '20', month: '11', year: '2026' },
      { errorKey: 'future', errorFields: ['day', 'month', 'year'] }
    ]
  ])('returns the appropriate validation error for %o', (values, expected) => {
    expect(validateVaccinationDate(datePayload(values), today)).toEqual({
      errorKey: expected.errorKey,
      errorFields: expected.errorFields.map(
        (part) => `vaccination-date-${part}`
      )
    })
  })
})

describe('#vaccinationDateController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  beforeEach(() => {
    backendRequest.mockResolvedValue(workOrder)
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('shows the vaccination date question', async () => {
    const response = await server.inject({ method: 'GET', url: pageUrl })

    expect(response.statusCode).toBe(statusCodes.ok)
    expect(backendRequest).toHaveBeenCalledWith(
      '/workorders/CV%20WorkOrder%202'
    )

    const $page = load(response.result)
    const form = $page('form[action$="/report-vaccination/date"]')
    const inputs = form.find('.govuk-date-input__input')
    const buttons = form.find('button')

    expect($page('title').text()).toContain('What was the date of vaccination?')
    expect($page('.govuk-caption-m').text()).toBe(
      'Report bTB vaccination for Tarbh Farm'
    )
    expect($page('h1').text()).toContain('What was the date of vaccination?')
    expect($page('#vaccination-date-hint').text().trim()).toBe(
      'For example, 20 4 2028'
    )
    expect($page('.govuk-back-link').attr('href')).toBe(
      '/work-orders/CV%20WorkOrder%202'
    )
    expect(form.attr('method')).toBe('post')
    expect(form.attr('action')).toBe(pageUrl)
    expect(form.find('input[name="crumb"]').val()).toBeTruthy()
    expect(inputs.map((_, input) => $page(input).attr('name')).get()).toEqual([
      'vaccination-date-day',
      'vaccination-date-month',
      'vaccination-date-year'
    ])
    expect(inputs.eq(1).attr('inputmode')).toBe('text')
    expect(buttons.eq(0).text()).toContain('Continue and save')
    expect(buttons.eq(0).attr('value')).toBe('continue')
    expect(buttons.eq(1).text()).toContain('Save and continue later')
    expect(buttons.eq(1).hasClass('govuk-button--secondary')).toBe(true)
  })

  test('provides the question in Welsh', async () => {
    const response = await server.inject({
      method: 'GET',
      url: `${pageUrl}?lang=cy`
    })
    const $page = load(response.result)

    expect(response.statusCode).toBe(statusCodes.ok)
    expect($page('.govuk-caption-m').text()).toBe(
      'Adrodd am frechiad bTB ar gyfer Tarbh Farm'
    )
    expect($page('h1').text()).toContain('Beth oedd dyddiad y brechiad?')
    expect($page('label[for="vaccination-date-day"]').text().trim()).toBe(
      'Diwrnod'
    )
    expect(
      $page('form[action$="/report-vaccination/date"] button').first().text()
    ).toContain('Parhau a chadw')
  })

  test('stores a valid date in the session and returns to the task list', async () => {
    const page = await server.inject({ method: 'GET', url: pageUrl })
    const saved = await submitDate(server, page, {
      day: '05',
      month: 'January',
      year: '2020'
    })

    expect(saved.statusCode).toBe(303)
    expect(saved.headers.location).toBe('/work-orders/CV%20WorkOrder%202')

    const revisited = await server.inject({
      method: 'GET',
      url: pageUrl,
      headers: { cookie: cookiesFrom(page, saved) }
    })
    const $revisited = load(revisited.result)

    expect($revisited('#vaccination-date-day').val()).toBe('05')
    expect($revisited('#vaccination-date-month').val()).toBe('01')
    expect($revisited('#vaccination-date-year').val()).toBe('2020')

    const otherWorkList = await server.inject({
      method: 'GET',
      url: otherWorkListPageUrl,
      headers: { cookie: cookiesFrom(page, saved) }
    })
    const $otherWorkList = load(otherWorkList.result)

    expect($otherWorkList('#vaccination-date-day').val()).toBe('')
    expect($otherWorkList('#vaccination-date-month').val()).toBe('')
    expect($otherWorkList('#vaccination-date-year').val()).toBe('')
  })

  test('highlights the whole date when nothing is entered', async () => {
    const page = await server.inject({ method: 'GET', url: pageUrl })
    const response = await submitDate(server, page)
    const $page = load(response.result)

    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect($page('.govuk-error-summary__list a').text()).toBe(
      'Enter the vaccination date'
    )
    expect($page('.govuk-error-summary__list a').attr('href')).toBe(
      '#vaccination-date-day'
    )
    expect($page('.govuk-input--error')).toHaveLength(3)
  })

  test('highlights only the incomplete fields', async () => {
    const page = await server.inject({ method: 'GET', url: pageUrl })
    const response = await submitDate(server, page, {
      day: '',
      month: 'Jan',
      year: '26'
    })
    const $page = load(response.result)

    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect($page('.govuk-error-message').text()).toContain(
      'Vaccination date must include a day and year'
    )
    expect($page('#vaccination-date-day').hasClass('govuk-input--error')).toBe(
      true
    )
    expect(
      $page('#vaccination-date-month').hasClass('govuk-input--error')
    ).toBe(false)
    expect($page('#vaccination-date-year').hasClass('govuk-input--error')).toBe(
      true
    )
  })

  test('links to the invalid field and retains the submitted value', async () => {
    const page = await server.inject({ method: 'GET', url: pageUrl })
    const response = await submitDate(server, page, {
      day: '12',
      month: ' Smarch ',
      year: '2020'
    })
    const $page = load(response.result)

    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect($page('.govuk-error-message').text()).toContain(
      'Vaccination date must be a real date'
    )
    expect($page('.govuk-input--error')).toHaveLength(1)
    const errorHref = $page('.govuk-error-summary__list a').attr('href')
    expect(errorHref).toBe('#vaccination-date-month')
    expect($page(errorHref).attr('name')).toBe('vaccination-date-month')
    expect($page(errorHref).hasClass('govuk-input--error')).toBe(true)
    expect($page(errorHref).val()).toBe(' Smarch ')
  })

  test('shows Welsh validation errors and retains the submitted date parts', async () => {
    const page = await server.inject({
      method: 'GET',
      url: `${pageUrl}?lang=cy`
    })
    const response = await submitDate(server, page, {
      day: '31',
      month: 'Chwefror',
      year: '2020'
    })
    const $page = load(response.result)

    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect($page('.govuk-error-summary__list a').text()).toBe(
      'Rhaid i ddyddiad y brechiad fod yn ddyddiad go iawn'
    )
    expect($page('.govuk-error-summary__list a').attr('href')).toBe(
      '#vaccination-date-day'
    )
    expect($page('#vaccination-date-day').val()).toBe('31')
    expect($page('#vaccination-date-month').val()).toBe('Chwefror')
    expect($page('#vaccination-date-year').val()).toBe('2020')
    expect($page('.govuk-input--error')).toHaveLength(3)
  })

  test('highlights the whole date when it is in the future', async () => {
    const page = await server.inject({ method: 'GET', url: pageUrl })
    const response = await submitDate(server, page, {
      day: '1',
      month: 'Jan',
      year: '9999'
    })
    const $page = load(response.result)

    expect(response.statusCode).toBe(statusCodes.badRequest)
    expect($page('.govuk-error-message').text()).toContain(
      'The vaccination date must be today or in the past'
    )
    expect($page('.govuk-input--error')).toHaveLength(3)
  })

  test.each(['missing', 'invalid'])(
    'rejects a submission with a %s crumb',
    async (crumbType) => {
      const page = await server.inject({ method: 'GET', url: pageUrl })
      backendRequest.mockClear()
      const response = await submitDate(
        server,
        page,
        { day: '1', month: '1', year: '2020' },
        crumbType === 'invalid' ? 'invalid' : null
      )

      expect(response.statusCode).toBe(statusCodes.forbidden)
      expect(backendRequest).not.toHaveBeenCalled()
    }
  )

  test('returns not found when the work order does not exist', async () => {
    const error = new Error('Backend request failed with status 404')
    error.statusCode = statusCodes.notFound
    backendRequest.mockRejectedValue(error)

    const response = await server.inject({ method: 'GET', url: pageUrl })

    expect(response.statusCode).toBe(statusCodes.notFound)
  })
})
