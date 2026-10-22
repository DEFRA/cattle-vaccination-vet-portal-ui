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
    title: 'Odds Farm Park - 40/715/9200',
    cphName: 'Odds Farm Park',
    cphCode: '40/715/9200',
    cphNumber: '407159200',
    address: 'Odds Farm Park, Wooburn Common Rd, High Wycombe, HP10 0LX'
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
      'Odds Farm Park - 40/715/9200'
    )
    expect($page('.govuk-summary-list__value').text()).toContain(
      'Odds Farm Park, Wooburn Common Rd, High Wycombe, HP10 0LX'
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
      cphName: 'Odds Farm Park',
      cphCode: '40/715/9200',
      cphNumber: '407159200',
      address: 'Odds Farm Park, Wooburn Common Rd, High Wycombe, HP10 0LX',
      workLists: []
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
    expect($page('main .govuk-back-link')).toHaveLength(0)
    expect($page('h1').text()).toContain('Odds Farm Park task list')
    expect(information).toContain('CPH number: 40/715/9200')
    expect(information).toContain(
      'Address: Odds Farm Park, Wooburn Common Rd, High Wycombe, HP10 0LX'
    )
    expect($page('a.govuk-link').text()).toContain('Full CPH information')
    expect($page('#vaccination-lists').text()).toBe('Vaccination lists')
    expect(result).toContain(
      'Before visiting the CPH, create an up to date vaccination list.'
    )
    expect($page('button.govuk-button').text()).toContain(
      'Create vaccination list'
    )
    expect($page('.govuk-summary-list')).toHaveLength(0)
    expect(result).not.toContain('issue date')
    expect(result).not.toContain('CPH contact')
    expect(result).not.toContain('Email address')
    expect(result).not.toContain('Work lists')
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
})
