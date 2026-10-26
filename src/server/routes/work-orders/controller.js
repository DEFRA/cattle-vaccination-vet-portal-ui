import { statusCodes } from '#/server/common/constants/status-codes.js'
import { backendRequest } from '#/server/common/helpers/backend-client.js'

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
      heading: request.t('pages.workOrder.heading', { name }),
      workOrderId: request.params.workOrderId,
      cphCode: cph?.cphCode,
      address: cph?.address,
      workLists: workOrder.workLists || []
    })
  }
}

/**
 * Creates a work list, then returns to the work order page.
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
      .redirect(`/work-orders/${encodeURIComponent(workOrderId)}`)
      .code(303)
  }
}
