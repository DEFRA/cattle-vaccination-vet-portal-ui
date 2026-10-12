import { statusCodes } from '#/server/common/constants/status-codes.js'
import { backendRequest } from '#/server/common/helpers/backend-client.js'

export const backendHealthController = {
  async handler(_request, h) {
    const result = await backendRequest('/health')
    return h.response(result).code(statusCodes.ok)
  }
}
