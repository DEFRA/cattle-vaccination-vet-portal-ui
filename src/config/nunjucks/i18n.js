import path from 'node:path'
import i18next from 'i18next'
import Backend from 'i18next-fs-backend'
import i18nextMiddleware from 'i18next-http-middleware'

import { config } from '#/config/config.js'

export const supportedLanguages = ['en', 'cy']

await i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    backend: {
      loadPath: path.resolve(
        config.get('root'),
        'src/server/locales/{{lng}}/{{ns}}.json'
      )
    },
    detection: {
      order: ['querystring', 'cookie', 'header'],
      lookupQuerystring: 'lang',
      lookupCookie: 'i18next',
      caches: ['cookie'],
      cookieSecure: config.get('session.cookie.secure'),
      cookieHttpOnly: true,
      cookieSameSite: 'lax'
    },
    fallbackLng: 'en',
    supportedLngs: supportedLanguages,
    preload: supportedLanguages,
    load: 'languageOnly',
    ns: ['common'],
    defaultNS: 'common'
  })

export const i18nPlugin = {
  plugin: i18nextMiddleware.hapiPlugin,
  options: { i18next }
}

export function getTranslator(language) {
  return i18next.getFixedT(language)
}

export { i18next }
