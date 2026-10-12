import { backendHealthController } from './controller.js'

export const backendHealth = {
  plugin: {
    name: 'backend-health',
    register(server) {
      server.route({
        method: 'GET',
        path: '/backend-health',
        ...backendHealthController
      })
    }
  }
}
