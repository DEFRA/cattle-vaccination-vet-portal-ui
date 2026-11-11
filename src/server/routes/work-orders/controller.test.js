import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { backendRequest } from '#/server/common/helpers/backend-client.js'
import { load } from 'cheerio'

vi.mock('#/server/common/helpers/backend-client.js', () => ({
  backendRequest: vi.fn()
}))

const workOrders = [
  {
    id: 'CV WorkOrder 2',
    title: 'Hill Farm - 40/715/9200',
    cphName: 'Hill Farm',
    cphCode: '40/715/9200',
    cphNumber: '407159200',
    address: '1 Farm Lane, Testtown, ZZ1 1ZZ'
  }
]

describe('#workOrdersController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  beforeEach(() => {
    backendRequest.mockResolvedValue(workOrders)
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should list work orders from the backend', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(backendRequest).toHaveBeenCalledWith('/workorders')

    const $page = load(result)

    expect($page('[data-testid="app-heading-caption"]')).toHaveLength(0)
    expect(
      $page('.govuk-grid-column-two-thirds [data-testid="work-orders"]')
    ).toHaveLength(1)
    expect($page('.govuk-summary-card__title').text()).toContain(
      'Hill Farm - 40/715/9200'
    )
    expect($page('.govuk-summary-list__value').text()).toContain(
      '1 Farm Lane, Testtown, ZZ1 1ZZ'
    )
    const actions = $page('.govuk-summary-card__action a')

    expect(actions.eq(0).text()).toContain('Continue work')
    expect(actions.eq(0).attr('href')).toBe('/work-orders/CV%20WorkOrder%202')
    expect(actions.eq(1).text()).toContain('CPH details')
    expect(actions.eq(1).attr('href')).toBe('#')
    expect(result).not.toContain('Issued date')
    expect(result).not.toContain('Tasks to complete')
  })
})

describe('#workOrderController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should show the CPH information we have', async () => {
    backendRequest.mockResolvedValue({
      id: 'CV WorkOrder 2',
      cph: {
        id: '407159200',
        displayName: '40/715/9200',
        cphCode: '40/715/9200',
        startDate: '2026-10-06',
        endDate: null,
        locationName: 'Hill Farm',
        address: '1 Farm Lane, Testtown, ZZ1 1ZZ'
      },
      workLists: [
        {
          id: 'a0W000000000002',
          name: 'CV WorkList 2',
          createdDate: '2026-10-08T09:00:00.000+0000'
        }
      ]
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%202'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(backendRequest).toHaveBeenCalledWith(
      '/workorders/CV%20WorkOrder%202'
    )

    const $page = load(result)
    const information = $page('h2')
      .filter((_, heading) => $page(heading).text() === 'CPH information')
      .next('p')
      .text()

    expect(
      $page('.govuk-width-container > .govuk-back-link').attr('href')
    ).toBe('/work-orders')
    expect($page('.govuk-width-container > .govuk-back-link').text()).toBe(
      'Back to ‘My work’'
    )
    expect($page('main .govuk-back-link')).toHaveLength(0)
    expect($page('h1').text()).toContain(
      'Hill Farm task list: issue date 6 October 2026'
    )
    expect(information).toContain('CPH number: 40/715/9200')
    expect(information).toContain('Address: 1 Farm Lane, Testtown, ZZ1 1ZZ')
    expect($page('#vaccination-lists').text()).toBe('Vaccination lists')
    expect(result).toContain(
      'Before visiting the farm, create an up-to-date vaccination list.'
    )
    const form = $page('form[action^="/work-orders/"]')
    const workListLink = $page('#latest-list')

    expect($page('.app-table-stacked__date').text()).toBe('List date')
    expect(workListLink.text()).toContain(
      'bTB vaccination list Hill Farm 8 Oct 2026 (opens in a new tab)'
    )
    expect(workListLink.attr('href')).toBe(
      '/work-orders/CV%20WorkOrder%202/work-lists/a0W000000000002'
    )
    expect(workListLink.attr('target')).toBe('_blank')
    expect(workListLink.attr('rel')).toBe('noopener noreferrer')
    expect(form.attr('method')).toBe('post')
    expect(form.attr('action')).toBe('/work-orders/CV%20WorkOrder%202')
    expect(form.find('input[name="crumb"]').val()).toBeTruthy()
    expect(form.find('button.govuk-button').text()).toContain(
      'Create vaccination list'
    )
    expect(
      form.find('button.govuk-button').attr('data-prevent-double-click')
    ).toBe('true')
    expect($page('.govuk-summary-list')).toHaveLength(0)
    expect(result).not.toContain('CPH contact')
    expect(result).not.toContain('Email address')
    expect(result).not.toContain('Work lists')
    expect(result).not.toContain('Full CPH information')
  })

  test('Should return not found when the work order does not exist', async () => {
    const error = new Error('Backend request failed with status 404')
    error.statusCode = statusCodes.notFound
    backendRequest.mockRejectedValue(error)

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%2099'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })

  test('Should create a work list and return to the work order', async () => {
    backendRequest.mockResolvedValue({
      id: 'CV WorkOrder 2',
      cph: { locationName: 'Hill Farm' },
      workLists: []
    })

    const page = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%202'
    })
    const $page = load(page.result)
    const form = $page('form[action^="/work-orders/"]')
    const crumbCookie = page.headers['set-cookie'].find((value) =>
      value.startsWith('crumb=')
    )

    backendRequest.mockClear()
    backendRequest.mockResolvedValue({ id: 'a0W000000000003' })

    const response = await server.inject({
      method: 'POST',
      url: '/work-orders/CV%20WorkOrder%202',
      headers: {
        cookie: crumbCookie.split(';')[0],
        'content-type': 'application/x-www-form-urlencoded'
      },
      payload: new URLSearchParams({
        crumb: form.find('input[name="crumb"]').val()
      }).toString()
    })

    expect(response.statusCode).toBe(303)
    expect(response.headers.location).toBe(
      '/work-orders/CV%20WorkOrder%202#latest-list'
    )
    expect(backendRequest).toHaveBeenCalledWith(
      '/workorders/CV%20WorkOrder%202/work-lists',
      { method: 'POST' }
    )
  })
})

describe('#workListController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  test('Should show the cattle on the work list', async () => {
    backendRequest.mockResolvedValue({
      id: 'a0W000000000002',
      name: 'CV WorkList 2',
      createdDate: '2026-10-08T09:00:00.000+0000',
      cphName: 'Hill Farm',
      cphCode: '40/715/9200',
      cattle: [
        {
          earTag: 'UK977985345673',
          dob: '2020-11-04',
          sex: 'Male',
          breed: 'WPA'
        }
      ]
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%202/work-lists/a0W000000000002'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(backendRequest).toHaveBeenCalledWith(
      '/workorders/CV%20WorkOrder%202/work-lists/a0W000000000002'
    )

    const $page = load(result)
    const cells = $page('.app-work-list__sheet')
      .first()
      .find('.app-work-list__record-table th, .app-work-list__record-table td')
      .map((_, cell) => $page(cell).text().trim())
      .get()

    expect($page('title').text()).toContain('Hill Farm - bTB vaccination list')
    expect($page('.app-work-list__sheet-title').first().text()).toBe(
      'Hill Farm - bTB vaccination list'
    )
    expect($page('.app-work-list__toolbar').text()).toContain(
      'Hill Farm · 1 cattle · 2 pages'
    )
    expect($page('[data-print-work-list]').text()).toBe('Print this list')
    expect($page('.app-work-list__meta').text()).toContain(
      'CPH:40/715/9200'
    )
    expect($page('.app-work-list__meta').text()).toContain(
      'Date list was made:Thursday 8 October 2026'
    )
    expect($page('.app-work-list__range').first().text()).toBe('5673–5673')
    expect($page('.app-work-list__last-four').text()).toBe('5673')
    expect($page('.app-work-list__sheet').last().text()).toContain(
      'This page left blank to capture unexpected cattle.'
    )
    expect(cells).toEqual([
      'No.',
      'Ear tag number',
      'DOB',
      'Sex',
      'Breed',
      'Notes/vaccine batch',
      '1',
      'UK 977985 345673',
      '04/11/2020',
      'Male',
      'WPA',
      ''
    ])
  })

  test('Should paginate the printable list like the prototype', async () => {
    const cattle = Array.from({ length: 46 }, (_, index) => ({
      earTag:
        index === 1
          ? 'UK999999990001'
          : `UK12345678${String(index + 1).padStart(4, '0')}`,
      dob: '2020-11-04',
      sex: 'Female',
      breed: 'HFR'
    }))
    backendRequest.mockResolvedValue({
      id: 'a0W000000000002',
      name: 'CV WorkList 2',
      createdDate: '2026-10-08T09:00:00.000+0000',
      cphName: 'Hill Farm',
      cphCode: '40/715/9200',
      cattle
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%202/work-lists/a0W000000000002'
    })

    expect(statusCode).toBe(statusCodes.ok)

    const $page = load(result)
    const sheets = $page('.app-work-list__sheet')
    const recordCounts = sheets
      .slice(0, 3)
      .map(
        (_, sheet) =>
          $page(sheet).find('.app-work-list__record-table tbody').toArray()
            .length
      )
      .get()
    const ranges = sheets
      .slice(0, 3)
      .map((_, sheet) =>
        $page(sheet)
          .find('.app-work-list__sheet-header .app-work-list__range')
          .text()
      )
      .get()

    expect(sheets).toHaveLength(4)
    expect(recordCounts).toEqual([20, 25, 1])
    expect(ranges).toEqual(['0001–0020', '0021–0045', '0046–0046'])
    expect($page('.app-work-list__last-four--duplicate')).toHaveLength(2)
    expect($page('.app-work-list__page-number').last().text()).toBe(
      'Page 4 of 4'
    )
  })

  test('Should return not found when the work list does not exist', async () => {
    const error = new Error('Backend request failed with status 404')
    error.statusCode = statusCodes.notFound
    backendRequest.mockRejectedValue(error)

    const { statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%202/work-lists/a0W000000000099'
    })

    expect(statusCode).toBe(statusCodes.notFound)
  })
})
