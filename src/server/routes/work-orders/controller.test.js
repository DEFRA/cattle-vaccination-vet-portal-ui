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
    expect($page('.govuk-summary-card__action').text()).toContain(
      'Continue work'
    )
    expect($page('.govuk-summary-card__action').text()).toContain('CPH details')
    expect(result).not.toContain('Issued date')
    expect(result).not.toContain('Tasks to complete')
  })
})
