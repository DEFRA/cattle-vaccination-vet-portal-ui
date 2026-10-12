import { GetWebIdentityTokenCommand, STSClient } from '@aws-sdk/client-sts'

import { config } from '#/config/config.js'
import { createLogger } from './logging/logger.js'

const logger = createLogger()
const expiryBufferMs = 30000

let cached = { token: null, expiresAt: 0 }

async function fetchToken() {
  const audience = config.get('serviceAuth.audience')
  const tokenDurationSeconds = config.get('serviceAuth.tokenDurationSeconds')
  const client = new STSClient()
  const result = await client.send(
    new GetWebIdentityTokenCommand({
      Audience: [audience],
      DurationSeconds: tokenDurationSeconds,
      SigningAlgorithm: 'RS256'
    })
  )

  return {
    token: result.WebIdentityToken,
    expiresAt: Date.now() + tokenDurationSeconds * 1000 - expiryBufferMs
  }
}

export async function getServiceToken() {
  if (!cached.token || Date.now() >= cached.expiresAt) {
    logger.info('Fetching service-to-service JWT token')
    cached = await fetchToken()
  }

  return cached.token
}

export function clearServiceTokenCache() {
  cached = { token: null, expiresAt: 0 }
}
