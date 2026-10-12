import { config } from '#/config/config.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger()

export const serviceToken = {
  plugin: {
    name: 'service-token',
    register() {
      if (!config.get('serviceAuth.enabled')) {
        logger.info('Service-to-service authentication is disabled')
        return
      }

      logger.info(
        'Service-to-service authentication enabled - tokens will be fetched on demand'
      )
    }
  }
}
