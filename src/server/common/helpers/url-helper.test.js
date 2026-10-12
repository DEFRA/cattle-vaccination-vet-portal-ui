import { sanitiseInternalRedirectUrl } from './url-helper.js'

describe('#sanitiseInternalRedirectUrl', () => {
  test.each([
    ['/', '/'],
    ['/about', '/about'],
    ['/about?from=home#details', '/about?from=home#details'],
    [' /about ', '/about'],
    ['/some%20page', '/some%20page'],
    ['/first/../about', '/about']
  ])('Should sanitise an internal URL: %s', (path, expected) => {
    expect(sanitiseInternalRedirectUrl(path)).toBe(expected)
    expect(sanitiseInternalRedirectUrl(path, '/home')).toBe(expected)
  })

  test.each([
    undefined,
    null,
    42,
    {},
    '',
    'about',
    'https://external.example/path',
    '//external.example/path',
    '/\\external.example/path',
    '/path%2f%2fexternal.example',
    '/path%2F%2Fexternal.example',
    '/path%5cexternal.example',
    '/path%255c%255cexternal.example',
    '/path%252f%252fexternal.example',
    '/path%0d%0aHeader:value',
    '/path\nHeader:value',
    '/path\u007f',
    '/bad%',
    '/bad%FF',
    '/first/..//external.example/path'
  ])('Should fall back to the home page for an unsafe URL: %s', (path) => {
    expect(sanitiseInternalRedirectUrl(path)).toBe('/')
    expect(sanitiseInternalRedirectUrl(path, '/home')).toBe('/home')
  })

  test('Should default to the home page when the fallback is undefined', () => {
    expect(
      sanitiseInternalRedirectUrl('https://external.example', undefined)
    ).toBe('/')
  })
})
