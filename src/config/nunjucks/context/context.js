import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '#/config/config.js'
import { buildNavigation } from './build-navigation.js'
import { buildLanguageUrl } from './build-language-url.js'
import { createLogger } from '#/server/common/helpers/logging/logger.js'
import { getTranslator, supportedLanguages } from '../i18n.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/.vite/manifest.json'
)

let viteManifest

export function context(request) {
  const requestedLanguage = request?.language?.split('-')[0]
  const language = supportedLanguages.includes(requestedLanguage)
    ? requestedLanguage
    : 'en'
  const t = request?.t ?? getTranslator(language)

  if (config.get('isProduction') && !viteManifest) {
    try {
      viteManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(`Vite ${path.basename(manifestPath)} not found`)
    }
  }

  return {
    cspNonce: request?.plugins?.blankie?.nonces?.script,
    assetPath: `${assetPath}/assets`,
    serviceName: t('service.name'),
    serviceUrl: '/',
    htmlLang: language,
    t,
    languageNavigation: {
      ariaLabel: t('language.navigationLabel'),
      items: [
        {
          lang: 'en',
          text: t('language.en'),
          href: buildLanguageUrl(request?.path, 'en'),
          current: language === 'en'
        },
        {
          lang: 'cy',
          text: t('language.cy'),
          href: buildLanguageUrl(request?.path, 'cy'),
          current: language === 'cy'
        }
      ]
    },
    breadcrumbs: [],
    navigation: buildNavigation(request),
    getAssetPath(asset) {
      if (!config.get('isProduction')) {
        return `${assetPath}/${asset}`
      }

      const viteAssetPath = viteManifest?.[asset]?.file
      return `${assetPath}/${viteAssetPath ?? asset}`
    }
  }
}
