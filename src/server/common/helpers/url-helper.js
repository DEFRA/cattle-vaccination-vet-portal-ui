const internalOrigin = 'https://internal.invalid'
// eslint-disable-next-line no-control-regex
const controlCharacters = /[\u0000-\u001f\u007f]/

export function sanitiseInternalRedirectUrl(path, fallback = '/') {
  if (typeof path !== 'string') {
    return fallback
  }

  const candidate = path.trim()

  if (
    !candidate.startsWith('/') ||
    candidate.startsWith('//') ||
    candidate.includes('\\') ||
    controlCharacters.test(candidate) ||
    /%(?:2f|5c)/i.test(candidate)
  ) {
    return fallback
  }

  let decodedPath

  try {
    decodedPath = decodeURIComponent(candidate)
  } catch {
    return fallback
  }

  if (
    !decodedPath.startsWith('/') ||
    decodedPath.startsWith('//') ||
    decodedPath.includes('\\') ||
    controlCharacters.test(decodedPath) ||
    /%[0-9a-f]{2}/i.test(decodedPath)
  ) {
    return fallback
  }

  const url = new URL(decodedPath, internalOrigin)

  if (url.origin !== internalOrigin || url.pathname.startsWith('//')) {
    return fallback
  }

  return `${url.pathname}${url.search}${url.hash}`
}
