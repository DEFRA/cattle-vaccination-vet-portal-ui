const internalOrigin = 'https://internal.invalid'
// eslint-disable-next-line no-control-regex
const controlCharacters = /[\u0000-\u001f\u007f]/

export function buildLanguageUrl(path, language) {
  const fallbackUrl = `/?lang=${encodeURIComponent(language)}`

  if (typeof path !== 'string') {
    return fallbackUrl
  }

  const candidate = path.trim()

  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    controlCharacters.test(candidate) ||
    /%(?:2f|5c)/i.test(candidate)
  ) {
    return fallbackUrl
  }

  let decodedPath

  try {
    decodedPath = decodeURIComponent(candidate)
  } catch {
    return fallbackUrl
  }

  if (
    !decodedPath.startsWith('/') ||
    decodedPath.startsWith('//') ||
    decodedPath.includes('\\') ||
    controlCharacters.test(decodedPath) ||
    /%[0-9a-f]{2}/i.test(decodedPath)
  ) {
    return fallbackUrl
  }

  const url = new URL(decodedPath, internalOrigin)

  if (url.origin !== internalOrigin) {
    return fallbackUrl
  }

  url.searchParams.set('lang', language)
  return `${url.pathname}${url.search}${url.hash}`
}
