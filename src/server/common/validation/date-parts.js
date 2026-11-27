import Joi from 'joi'
import { enGB, cy } from 'date-fns/locale'

export const dateFields = ['day', 'month', 'year']

function parseMonthName(value) {
  const name = value
    .toLocaleLowerCase('en-GB')
    .replace(/\.$/, '')
    .replace(/^sept$/, 'sep')

  for (const locale of [enGB, cy]) {
    const match =
      locale.match.month(name, { width: 'wide' }) ??
      locale.match.month(name, { width: 'abbreviated' })

    if (match?.rest === '') {
      return match.value + 1
    }
  }
}

const dayPart = Joi.string()
  .trim()
  .empty('')
  .required()
  .pattern(/^\d{1,2}$/)
  .custom((value, helpers) => {
    const day = Number(value)
    return day >= 1 && day <= 31 ? day : helpers.error('any.invalid')
  })

const monthPart = Joi.string()
  .trim()
  .empty(
    Joi.string()
      .allow('')
      .pattern(/^[a-z]{1,2}$/iu)
  )
  .required()
  .custom((value, helpers) => {
    const month = /^\d{1,2}$/.test(value)
      ? Number(value)
      : parseMonthName(value)

    return month >= 1 && month <= 12 ? month : helpers.error('any.invalid')
  })

const yearPart = Joi.string()
  .trim()
  .empty(
    Joi.string()
      .allow('')
      .pattern(/^\d{1,3}$/)
  )
  .required()
  .pattern(/^\d{4}$/)
  .invalid('0000')

function isRealDate(year, month, day) {
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function fieldName(part, namePrefix) {
  return namePrefix ? `${namePrefix}-${part}` : part
}

export function dateParts({ min, max, namePrefix } = {}) {
  const dayField = fieldName('day', namePrefix)
  const monthField = fieldName('month', namePrefix)
  const yearField = fieldName('year', namePrefix)

  return Joi.object({
    [dayField]: dayPart,
    [monthField]: monthPart,
    [yearField]: yearPart
  })
    .required()
    .custom((parts, helpers) => {
      const day = parts[dayField]
      const month = parts[monthField]
      const year = parts[yearField]

      if (!isRealDate(Number(year), month, day)) {
        return helpers.error('any.invalid')
      }

      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      if (min && date < min) {
        return helpers.error('date.min', { limit: min })
      }
      if (max && date > max) {
        return helpers.error('date.max', { limit: max })
      }
      return date
    })
    .messages({
      'date.min': '{{#label}} must be on or after {{#limit}}',
      'date.max': '{{#label}} must be on or before {{#limit}}'
    })
}

export function monthYearParts({ namePrefix } = {}) {
  const monthField = fieldName('month', namePrefix)
  const yearField = fieldName('year', namePrefix)

  return Joi.object({ [monthField]: monthPart, [yearField]: yearPart })
    .required()
    .custom((parts) => {
      const month = String(parts[monthField]).padStart(2, '0')
      return `${parts[yearField]}-${month}`
    })
}
