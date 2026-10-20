import { workOrdersController } from './controller.js'

/**
 * Sets up the routes used in the /work-orders page.
 * These routes are registered in src/server/plugins/router.js.
 */
export const workOrders = {
  plugin: {
    name: 'work-orders',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/work-orders',
          ...workOrdersController
        }
      ])
    }
  }
}
