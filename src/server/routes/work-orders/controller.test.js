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
    const actions = $page('.govuk-summary-card__actions a')

    expect(actions.eq(0).text()).toContain('View work')
    expect(actions.eq(0).attr('href')).toBe('/work-orders/CV%20WorkOrder%202')
    expect(actions).toHaveLength(1)
    expect(result).not.toContain('CPH details')
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
    expect($page('#vaccination-lists').text()).toBe(
      'Prepare for the farm visit'
    )
    expect(result).toContain(
      'Before heading to the farm, create an up-to-date vaccination list and respective report form.'
    )
    expect(result).toContain(
      'Create a vaccination list to confirm the number of cattle to vaccinate.'
    )
    const form = $page('form[action^="/work-orders/"]')
    const workListLink = $page('.govuk-task-list__link')

    expect($page('h2[id^="worklist-"]').text()).toBe(
      'Vaccination list: 8 Oct 2026'
    )
    expect($page('.govuk-task-list__status').text().trim()).toBe('Ready')
    expect(
      $page('.govuk-task-list__status .govuk-tag.govuk-tag--grey')
    ).toHaveLength(1)
    expect($page('.govuk-task-list__status').hasClass('govuk-tag--grey')).toBe(
      false
    )
    expect($page('.govuk-table')).toHaveLength(0)
    expect(workListLink.text()).toContain(
      'Download vaccination list (opens in a new tab)'
    )
    expect(workListLink.attr('href')).toBe(
      '/work-orders/CV%20WorkOrder%202/work-lists/a0W000000000002'
    )
    expect(workListLink.attr('target')).toBe('_blank')
    expect(workListLink.attr('rel')).toBe('noopener noreferrer')
    expect(workListLink.attr('aria-describedby')).toBe(
      'worklist-a0W000000000002 worklist-a0W000000000002-1-status'
    )
    expect(form.attr('method')).toBe('post')
    expect(form.attr('action')).toBe('/work-orders/CV%20WorkOrder%202')
    expect(form.find('input[name="crumb"]').val()).toBeTruthy()
    expect(form.find('button.govuk-button').text()).toContain(
      'Create vaccination list'
    )
    expect(form.find('button.govuk-button').attr('type')).toBe('submit')
    expect(
      $page(
        'script[type="module"][src$="/src/client/javascripts/application.js"]'
      )
    ).toHaveLength(1)
    expect(
      form.find('button.govuk-button').attr('data-prevent-double-click')
    ).toBe('true')
    expect(form.is('[data-create-work-list-form]')).toBe(true)
    expect(form.attr('data-submitting-message')).toBe(
      'Creating your vaccination list…'
    )
    expect(form.find('[data-create-work-list-status]').attr('role')).toBe(
      'status'
    )
    expect(
      form.find('[data-create-work-list-status]').hasClass('app-loading-status')
    ).toBe(true)
    expect(form.find('[data-create-work-list-status]').text()).toBe('')
    expect($page('.govuk-summary-list')).toHaveLength(0)
    expect(result).not.toContain('CPH contact')
    expect(result).not.toContain('Email address')
    expect(result).not.toContain('Work lists')
    expect(result).not.toContain('Full CPH information')
  })

  test('Should show each vaccination list in newest-first order with unique task descriptions', async () => {
    backendRequest.mockResolvedValue({
      id: 'CV WorkOrder 2',
      cph: { locationName: 'Hill Farm' },
      workLists: [
        { id: 'older/list', name: 'Older list', createdDate: '2026-03-08' },
        { id: 'new list', name: 'New list', createdDate: '2026-10-08' },
        { id: 'undated', name: '<Undated & list>', createdDate: null }
      ]
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%202?lang=cy'
    })
    expect(statusCode).toBe(statusCodes.ok)

    const $page = load(result)
    const lists = $page('.govuk-task-list')
    expect(lists).toHaveLength(3)
    expect(
      $page('h2[id^="worklist-"]')
        .map((_, h) => $page(h).text())
        .get()
    ).toEqual([
      'Rhestr frechu: 8 Hyd 2026',
      'Rhestr frechu: 8 Maw 2026',
      'Rhestr frechu: <Undated & list>'
    ])
    expect($page('h2[id^="worklist-"]').last().find('undated')).toHaveLength(0)
    expect(
      lists
        .find('.govuk-task-list__status')
        .map((_, s) => $page(s).text().trim())
        .get()
    ).toEqual(['Yn barod', 'Yn barod', 'Yn barod'])
    const links = lists.find('a')
    expect(links.eq(0).attr('href')).toBe(
      '/work-orders/CV%20WorkOrder%202/work-lists/new%20list'
    )
    expect(links.eq(1).attr('href')).toBe(
      '/work-orders/CV%20WorkOrder%202/work-lists/older%2Flist'
    )
    expect($page('h2[id^="worklist-"]').first().attr('id')).toBe(
      'worklist-new%20list'
    )
    expect($page('h2[id^="worklist-"]').eq(1).attr('id')).toBe(
      'worklist-older%2Flist'
    )
    expect(links.eq(0).attr('id')).toBeUndefined()
    expect(links.eq(1).attr('id')).toBeUndefined()
    expect(links.eq(1).attr('aria-describedby')).toBe(
      'worklist-older%2Flist worklist-older%2Flist-1-status'
    )
    expect(links.eq(0).text().trim()).toBe(
      "Lawrlwytho'r rhestr frechu (yn agor mewn tab newydd)"
    )
  })

  test('Should provide a Welsh progress message', async () => {
    backendRequest.mockResolvedValue({
      id: 'CV WorkOrder 2',
      cph: { locationName: 'Hill Farm' },
      workLists: []
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%202?lang=cy'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(
      load(result)('[data-create-work-list-form]').attr(
        'data-submitting-message'
      )
    ).toBe("Wrthi'n creu eich rhestr frechu…")
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

  test.each(['a0W000000000003', 'new list/3'])(
    'Should create work list %s and return to its heading',
    async (workListId) => {
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
      backendRequest.mockResolvedValue({ id: workListId })

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
      const headingId = `worklist-${encodeURIComponent(workListId)}`
      expect(response.headers.location).toBe(
        `/work-orders/CV%20WorkOrder%202#${encodeURIComponent(headingId)}`
      )
      expect(backendRequest).toHaveBeenCalledWith(
        '/workorders/CV%20WorkOrder%202/work-lists',
        { method: 'POST' }
      )
      backendRequest.mockResolvedValue({
        id: 'CV WorkOrder 2',
        cph: { locationName: 'Hill Farm' },
        workLists: [
          { id: workListId, name: 'New list', createdDate: '2026-11-13' }
        ]
      })
      const updatedPage = await server.inject({
        method: 'GET',
        url: response.headers.location.split('#')[0]
      })
      expect(updatedPage.statusCode).toBe(statusCodes.ok)
      expect(load(updatedPage.result)('h2[id^="worklist-"]').attr('id')).toBe(
        decodeURIComponent(response.headers.location.split('#')[1])
      )
    }
  )

  test.each(['missing', 'invalid'])(
    'Should reject a work list submission with a %s crumb',
    async (crumbType) => {
      backendRequest.mockResolvedValue({
        id: 'CV WorkOrder 2',
        cph: { locationName: 'Hill Farm' },
        workLists: []
      })
      const page = await server.inject({
        method: 'GET',
        url: '/work-orders/CV%20WorkOrder%202'
      })
      const crumbCookie = page.headers['set-cookie'].find((value) =>
        value.startsWith('crumb=')
      )
      backendRequest.mockClear()

      const response = await server.inject({
        method: 'POST',
        url: '/work-orders/CV%20WorkOrder%202',
        headers: {
          cookie: crumbCookie.split(';')[0],
          'content-type': 'application/x-www-form-urlencoded'
        },
        payload: new URLSearchParams(
          crumbType === 'invalid' ? { crumb: 'invalid' } : {}
        ).toString()
      })

      expect(response.statusCode).toBe(statusCodes.forbidden)
      expect(backendRequest).not.toHaveBeenCalled()
    }
  )
})

describe('#workListController', () => {
  let server

  afterEach(() => {
    vi.useRealTimers()
  })

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
    expect($page('[data-print-page]').text()).toBe('Print this list')
    expect($page('.app-work-list__meta').text()).toContain('CPH:40/715/9200')
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
      'M',
      'WPA',
      ''
    ])
  })

  test('Should show the work list when an animal has no sex recorded', async () => {
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
          sex: null,
          breed: 'WPA'
        }
      ]
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%202/work-lists/a0W000000000002'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(load(result)('tbody .app-work-list__sex').first().text()).toBe('')
  })

  test('Should show recent cattle BCG vaccination dates in the notes column', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-12T12:00:00Z'))
    backendRequest.mockResolvedValue({
      cphName: 'Hill Farm',
      cphCode: '40/715/9200',
      cattle: [
        {
          earTag: 'UK977985345673',
          lastVaccination: { cattleBCG: '2026-03-13' }
        },
        {
          earTag: 'UK977985345674',
          lastVaccination: { cattleBCG: '2026-03-12' }
        },
        {
          earTag: 'UK977985345675',
          lastVaccination: { cattleBCG: '2025-11-12' }
        },
        {
          earTag: 'UK977985345676',
          lastVaccination: { cattleBCG: '2025-11-11' }
        },
        {
          earTag: 'UK977985345677',
          lastVaccination: { cattleBCG: '2026-11-13' }
        },
        { earTag: 'UK977985345678' }
      ]
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%202/work-lists/a0W000000000002'
    })
    expect(statusCode).toBe(statusCodes.ok)
    expect(
      load(result)('.app-work-list__record-table tbody .app-work-list__notes')
        .map((_, cell) => load(cell).text())
        .get()
        .slice(0, 6)
    ).toEqual([
      'Not eligible: earliest vaccination date 13/11/2026',
      'Last vaccination date 12/03/2026',
      'Last vaccination date 12/11/2025',
      '',
      '',
      ''
    ])

    const welshResponse = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%202/work-lists/a0W000000000002?lang=cy'
    })

    expect(welshResponse.statusCode).toBe(statusCodes.ok)
    expect(
      load(welshResponse.result)(
        '.app-work-list__record-table tbody .app-work-list__notes'
      )
        .first()
        .text()
    ).toBe('Ddim yn gymwys: dyddiad brechu cynharaf 13/11/2026')
    expect(
      load(welshResponse.result)(
        '.app-work-list__record-table tbody .app-work-list__notes'
      )
        .eq(1)
        .text()
    ).toBe('Dyddiad y brechiad diwethaf 12/03/2026')
  })

  test('Should translate printable work list content into Welsh', async () => {
    backendRequest.mockResolvedValue({
      cphName: 'Hill & Farm',
      cphCode: '40/715/9200',
      createdDate: '2026-10-08T09:00:00.000+0000',
      cattle: [
        { earTag: 'UK977985345673', sex: 'Male' },
        { earTag: 'UK977985335673', sex: 'Female' },
        { earTag: 'UK977985345674', sex: 'Unknown' }
      ]
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/1/work-lists/1?lang=cy'
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $page = load(result)
    expect($page('html').attr('lang')).toBe('cy')
    expect($page('title').text()).toContain('Hill & Farm - rhestr frechu bTB')
    expect($page('.app-work-list__toolbar').text()).toContain(
      'Hill & Farm · 3 o wartheg · 2 dudalen'
    )
    expect($page('[data-print-page]').text()).toBe("Argraffu'r rhestr hon")
    expect($page('.app-work-list__sheet-title').first().text()).toBe(
      'Hill & Farm - rhestr frechu bTB'
    )
    expect($page('.app-work-list__meta').text()).toContain(
      "Dyddiad creu'r rhestr:dydd Iau 8 Hydref 2026"
    )
    expect(
      $page('.app-work-list__entry-table th')
        .map((_, cell) => $page(cell).text().trim())
        .get()
    ).toEqual([
      'Dyddiad brechu:',
      'Swp',
      'Rhif swp y brechlyn:',
      'Dyddiad dod i ben y brechlyn:',
      'Rhif swp yr hydoddyn:',
      'Dyddiad dod i ben yr hydoddyn:',
      '1',
      '2'
    ])
    expect(
      $page('.app-work-list__record-table')
        .first()
        .find('thead th')
        .map((_, cell) => $page(cell).text())
        .get()
    ).toEqual([
      'Rhif',
      'Rhif tag clust',
      'Dyddiad geni',
      'Rhyw',
      'Brîd',
      'Nodiadau/swp y brechlyn'
    ])
    expect(
      $page('.app-work-list__record-table tbody .app-work-list__sex')
        .map((_, cell) => $page(cell).text())
        .get()
    ).toEqual(['G', 'B', 'U'])
    expect(
      $page('.app-work-list__last-four--duplicate').first().attr('title')
    ).toBe(
      'Mae gan anifail arall ar y fferm hon yr un 4 digid olaf ar ei dag clust'
    )
    const blankPage = $page('.app-work-list__sheet').last()
    expect(blankPage.find('.app-work-list__sheet-title').text()).toBe(
      'Hill & Farm - Tudalen wag'
    )
    expect(blankPage.text()).toContain(
      'Gadawyd y dudalen hon yn wag i gofnodi gwartheg annisgwyl.'
    )
    expect(blankPage.find('thead th').last().text()).toBe('Sylwadau')
    expect(blankPage.find('.app-work-list__range').first().text()).toBe(
      'Tudalen wag'
    )
    expect(blankPage.find('.app-work-list__page-number').text()).toBe(
      'Tudalen 2 o 2'
    )
  })

  test('Should use singular page wording for an empty work list', async () => {
    backendRequest.mockResolvedValue({
      cphName: 'Hill Farm',
      cattle: []
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/1/work-lists/1'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(load(result)('.app-work-list__toolbar p').text()).toBe(
      'Hill Farm · 0 cattle · 1 page'
    )
  })

  test('Should escape farm names in translated headings', async () => {
    backendRequest.mockResolvedValue({
      cphName: '<img src=x>',
      cattle: [{ earTag: 'UK977985345673' }]
    })

    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/work-orders/1/work-lists/1?lang=cy'
    })

    expect(statusCode).toBe(statusCodes.ok)
    const $page = load(result)
    expect($page('title').text()).toContain('<img src=x> - rhestr frechu bTB')
    expect($page('.app-work-list__sheet-title').first().text()).toBe(
      '<img src=x> - rhestr frechu bTB'
    )
    expect($page('.app-work-list__sheet-title').last().text()).toBe(
      '<img src=x> - Tudalen wag'
    )
    expect($page('img')).toHaveLength(0)
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

    const welshResponse = await server.inject({
      method: 'GET',
      url: '/work-orders/CV%20WorkOrder%202/work-lists/a0W000000000002?lang=cy'
    })
    expect(welshResponse.statusCode).toBe(statusCodes.ok)
    const $welshPage = load(welshResponse.result)
    expect($welshPage('.app-work-list__toolbar p').text()).toBe(
      'Hill Farm · 46 o wartheg · 4 tudalen'
    )
    expect(
      $welshPage('.app-work-list__sheet')
        .eq(1)
        .find('.app-work-list__sheet-cph')
        .text()
    ).toBe('Hill Farm - CPH: 40/715/9200')
    expect($welshPage('.app-work-list__page-number').eq(1).text()).toBe(
      'Tudalen 2 o 4'
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
