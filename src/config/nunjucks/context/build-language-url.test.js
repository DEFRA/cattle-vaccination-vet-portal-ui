import { buildLanguageUrl } from './build-language-url.js'

describe('#buildLanguageUrl', () => {
  test('Should append the selected language to an internal path', () => {
    expect(buildLanguageUrl('/about', 'cy')).toBe('/about?lang=cy')
  })

  test('Should preserve existing query parameters and fragments', () => {
    expect(buildLanguageUrl('/about?from=home#details', 'cy')).toBe(
      '/about?from=home&lang=cy#details'
    )
  })

  test.each([
    'https://external.example/path',
    '//external.example/path',
    '/\\external.example/path',
    '/path%2f%2fexternal.example',
    '/path%255c%255cexternal.example',
    '/path%0d%0aHeader:value',
    '/bad%'
  ])('Should use the home page for an unsafe path: %s', (path) => {
    expect(buildLanguageUrl(path, 'cy')).toBe('/?lang=cy')
  })

  test('Should use the home page when the path is not a string', () => {
    expect(buildLanguageUrl(undefined, 'en')).toBe('/?lang=en')
  })
})
