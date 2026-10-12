import { sanitiseInternalRedirectUrl } from '../../../server/common/helpers/url-helper.js'

export function buildLanguageUrl(path, language) {
  const url = new URL(
    sanitiseInternalRedirectUrl(path),
    'https://internal.invalid'
  )
  url.searchParams.set('lang', language)
  return `${url.pathname}${url.search}${url.hash}`
}
