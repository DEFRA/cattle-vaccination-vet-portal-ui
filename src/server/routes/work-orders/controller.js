import { statusCodes } from '#/server/common/constants/status-codes.js'
import { backendRequest } from '#/server/common/helpers/backend-client.js'
import { formatDate } from '#/config/nunjucks/filters/format-date.js'

const firstWorkListPageSize = 20
const continuedWorkListPageSize = 25

function newestWorkListFirst(left, right) {
  return Date.parse(right.createdDate || 0) - Date.parse(left.createdDate || 0)
}

function splitEarTag(earTag) {
  const value = (earTag || '').replaceAll(/\s/g, '')
  const lastFour = value.slice(-4)

  if (/^UK\d{12}$/.test(value)) {
    return {
      prefix: `UK ${value.slice(2, 8)} ${value.slice(8, -4)}`,
      lastFour
    }
  }

  return {
    prefix: value.slice(0, -4),
    lastFour
  }
}

function buildWorkListRows(cattle) {
  const rows = cattle.map((animal, index) => ({
    ...animal,
    number: index + 1,
    dob: animal.dob ? formatDate(animal.dob, 'dd/MM/yyyy') : '',
    earTagParts: splitEarTag(animal.earTag)
  }))
  const lastFourCounts = rows.reduce((counts, row) => {
    const lastFour = row.earTagParts.lastFour

    if (lastFour) {
      counts[lastFour] = (counts[lastFour] || 0) + 1
    }

    return counts
  }, {})

  return rows.map((row) => ({
    ...row,
    hasDuplicateLastFour: lastFourCounts[row.earTagParts.lastFour] > 1
  }))
}

function buildWorkListSheets(rows) {
  const sheets = []

  for (let start = 0; start < rows.length;) {
    const pageSize =
      start === 0 ? firstWorkListPageSize : continuedWorkListPageSize
    const pageRows = rows.slice(start, start + pageSize)

    sheets.push({
      rows: pageRows,
      range: `${pageRows[0].earTagParts.lastFour}–${pageRows.at(-1).earTagParts.lastFour}`
    })
    start += pageSize
  }

  return sheets
}

/**
 * Work orders page controller.
 */
export const workOrdersController = {
  async handler(request, h) {
    const workOrders = await backendRequest('/workorders')

    return h.view('work-orders/index', {
      pageTitle: request.t('pages.workOrders.title'),
      heading: request.t('pages.workOrders.heading'),
      workOrders,
      breadcrumbs: [
        {
          text: request.t('navigation.home'),
          href: '/'
        },
        {
          text: request.t('navigation.workOrders')
        }
      ]
    })
  }
}

function workOrderNotFound(h) {
  return h
    .view('error/index', {
      pageTitle: 'Page not found',
      heading: statusCodes.notFound,
      message: 'Page not found'
    })
    .code(statusCodes.notFound)
}

/**
 * Work order task list page controller.
 */
export const workOrderController = {
  async handler(request, h) {
    let workOrder

    try {
      workOrder = await backendRequest(
        `/workorders/${encodeURIComponent(request.params.workOrderId)}`
      )
    } catch (error) {
      if (error.statusCode !== statusCodes.notFound) {
        throw error
      }

      return workOrderNotFound(h)
    }

    const cph = workOrder.cph
    const name = cph?.locationName || cph?.cphCode || workOrder.id

    return h.view('work-orders/details', {
      pageTitle: request.t('pages.workOrder.title', { name }),
      name,
      issueDate: cph?.startDate,
      workOrderId: request.params.workOrderId,
      cphCode: cph?.cphCode,
      address: cph?.address,
      workLists: (workOrder.workLists || []).toSorted(newestWorkListFirst)
    })
  }
}

/**
 * Creates a work list, then opens that work list.
 */
export const createWorkListController = {
  async handler(request, h) {
    const workOrderId = request.params.workOrderId

    try {
      await backendRequest(
        `/workorders/${encodeURIComponent(workOrderId)}/work-lists`,
        { method: 'POST' }
      )
    } catch (error) {
      if (error.statusCode !== statusCodes.notFound) {
        throw error
      }

      return workOrderNotFound(h)
    }

    return h
      .redirect(`/work-orders/${encodeURIComponent(workOrderId)}#latest-list`)
      .code(303)
  }
}

/**
 * Cattle on a work list.
 */
export const workListController = {
  async handler(request, h) {
    const { workOrderId, workListId } = request.params
    let workList

    try {
      workList = await backendRequest(
        `/workorders/${encodeURIComponent(workOrderId)}/work-lists/${encodeURIComponent(workListId)}`
      )
    } catch (error) {
      if (error.statusCode !== statusCodes.notFound) {
        throw error
      }

      return workOrderNotFound(h)
    }

    const rows = buildWorkListRows(workList.cattle)
    const sheets = buildWorkListSheets(rows)
    const farmName = workList.cphName || workList.cphCode || workList.name

    return h.view('work-orders/work-list', {
      pageTitle: request.t('pages.workList.title', {
        name: farmName,
        interpolation: { escapeValue: false }
      }),
      farmName,
      cphCode: workList.cphCode,
      createdDate: workList.createdDate,
      cattleCount: rows.length,
      sheets,
      totalPages: sheets.length + 1
    })
  }
}
