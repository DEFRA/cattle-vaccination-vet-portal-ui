export function safeReturnPath(value) {
  if (typeof value !== 'string') {
    return '/work-orders'
  }
  if (
    Array.from(value).some(
      (character) =>
        character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127
    ) ||
    /\\|%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f|25)/i.test(value)
  ) {
    return '/work-orders'
  }
  const origin = 'https://portal.invalid'
  try {
    const url = new URL(value, origin)
    if (
      !value.startsWith('/') ||
      value.startsWith('//') ||
      url.origin !== origin ||
      (url.pathname !== '/work-orders' &&
        !url.pathname.startsWith('/work-orders/'))
    ) {
      return '/work-orders'
    }
    return `${url.pathname}${url.search}`
  } catch {
    return '/work-orders'
  }
}
