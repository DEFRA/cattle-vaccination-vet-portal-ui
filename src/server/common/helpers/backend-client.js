import { config } from '#/config/config.js'
import { getServiceToken } from './service-token.js'

export async function getBackendAuthHeaders() {
  if (!config.get('serviceAuth.enabled')) {
    return {}
  }

  const token = await getServiceToken()
  if (!token) {
    return {}
  }

  return { authorization: `Bearer ${token}` }
}

export async function backendRequest(path) {
  const baseUrl = config.get('backend.baseUrl').replace(/\/$/, '')
  const headers = await getBackendAuthHeaders()
  const response = await fetch(`${baseUrl}${path}`, { headers })

  if (!response.ok) {
    const error = new Error(
      `Backend request failed with status ${response.status}`
    )
    error.statusCode = response.status
    throw error
  }

  return response.json()
}
