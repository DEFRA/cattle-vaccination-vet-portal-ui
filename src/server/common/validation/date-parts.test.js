import Joi from 'joi'

import { dateParts, monthYearParts } from './date-parts.js'

describe('#dateParts', () => {
  test('can be combined with other fields in a form schema', () => {
    const schema = Joi.object({
      batchNumber: Joi.string().required(),
      vaccinationDate: dateParts()
    })

    expect(
      schema.validate({
        batchNumber: 'ABC123',
        vaccinationDate: { day: '29', month: ' Chwefror ', year: '2028' }
      })
    ).toEqual({
      value: { batchNumber: 'ABC123', vaccinationDate: '2028-02-29' }
    })
  })

  test.each(['1900', '2026'])('rejects 29 February %s', (year) => {
    const { error } = dateParts().validate({ day: '29', month: '02', year })

    expect(error.details).toMatchObject([{ type: 'any.invalid', path: [] }])
  })

  test('preserves leading zeros in a four-digit year', () => {
    expect(
      dateParts().validate({ day: '1', month: '1', year: '0026' })
    ).toEqual({
      value: '0026-01-01'
    })
  })

  test.each([
    ['Sep', '09'],
    ['Sept.', '09'],
    ['Chwe', '02']
  ])('accepts the month abbreviation %s', (month, expectedMonth) => {
    expect(dateParts().validate({ day: '1', month, year: '2026' })).toEqual({
      value: `2026-${expectedMonth}-01`
    })
  })

  test.each(['January extra', 'Ionawrx'])('rejects the month %s', (month) => {
    const { error } = dateParts().validate({ day: '1', month, year: '2026' })

    expect(error.details).toMatchObject([
      { type: 'any.invalid', path: ['month'] }
    ])
  })

  test.each([
    ['1', 'date.min'],
    ['2', undefined],
    ['30', undefined],
    ['31', 'date.max']
  ])('enforces inclusive bounds for day %s', (day, errorType) => {
    const schema = dateParts({ min: '2026-01-02', max: '2026-01-30' })
    const { error, value } = schema.validate({ day, month: '1', year: '2026' })

    if (errorType) {
      expect(error.details).toMatchObject([{ type: errorType, path: [] }])
    } else {
      expect(error).toBeUndefined()
      expect(value).toBe(`2026-01-${day.padStart(2, '0')}`)
    }
  })
})

describe('#monthYearParts', () => {
  const vaccineExpiry = monthYearParts({ namePrefix: 'vaccine-expiry' })
  const diluentExpiry = monthYearParts({ namePrefix: 'diluent-expiry' })
  const options = { allowUnknown: true, abortEarly: false }

  test('returns separate month and year values from the same batch form', () => {
    const payload = {
      'vaccine-batch-number': '125007G',
      'vaccine-expiry-month': ' Rhagfyr ',
      'vaccine-expiry-year': '2033',
      'diluent-expiry-month': '11',
      'diluent-expiry-year': '2027'
    }

    expect(vaccineExpiry.validate(payload, options)).toEqual({
      value: '2033-12'
    })
    expect(diluentExpiry.validate(payload, options)).toEqual({
      value: '2027-11'
    })
  })

  test('reports errors against the submitted field names for each date', () => {
    const payload = {
      'vaccine-expiry-month': '13',
      'vaccine-expiry-year': '2033',
      'diluent-expiry-month': 'November',
      'diluent-expiry-year': '27'
    }

    expect(
      vaccineExpiry.validate(payload, options).error.details
    ).toMatchObject([{ type: 'any.invalid', path: ['vaccine-expiry-month'] }])
    expect(
      diluentExpiry.validate(payload, options).error.details
    ).toMatchObject([{ type: 'any.required', path: ['diluent-expiry-year'] }])
  })
})
