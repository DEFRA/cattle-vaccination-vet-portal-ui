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
