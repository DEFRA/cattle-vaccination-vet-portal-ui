import { createGovUkAnalyticsConsent } from '@transform-uk/govuk-analytics-consent'
import consentPlugin from '@transform-uk/govuk-analytics-consent/hapi'

import { config } from '#/config/config.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'

export const consent = createGovUkAnalyticsConsent({
  serviceName: config.get('serviceName'),
  cookiesPageUrl: '/cookies',
  secureCookie: config.get('isProduction'),
  logger: createLogger(),
  getLanguage: (request) => request.language,
  translate: (key, { request, language, values }) =>
    request.t(key, { lng: language, ...values }),
  getCsrfFormFields: (request) => ({ crumb: request.plugins.crumb }),
  tags: ['google-analytics'],
  cookies: [
    {
      name: 'govuk_analytics_consent',
      categoryId: 'essential',
      purpose: 'Saves your cookie consent settings',
      purposeKey: 'govuk-analytics-consent.cookies.consent.purpose',
      expiry: '1 year',
      expiryKey: 'govuk-analytics-consent.cookies.consent.expiry'
    },
    {
      name: 'crumb',
      categoryId: 'essential',
      purpose: 'Protects forms against cross-site request forgery.',
      purposeKey: 'govuk-analytics-consent.cookies.crumb.purpose',
      expiry: 'When you close your browser',
      expiryKey: 'govuk-analytics-consent.cookies.crumb.expiry'
    },
    {
      name: 'i18next',
      categoryId: 'essential',
      purpose: 'Remembers your language preference.',
      purposeKey: 'govuk-analytics-consent.cookies.i18next.purpose',
      expiry: '1 year',
      expiryKey: 'govuk-analytics-consent.cookies.i18next.expiry'
    }
  ]
})

export const cookieConsent = {
  plugin: consentPlugin,
  options: consent
}
