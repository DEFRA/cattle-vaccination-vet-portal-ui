import { statusCodes } from '#/server/common/constants/status-codes.js'
import { backendRequest } from '#/server/common/helpers/backend-client.js'

const sessionKey = 'vaccinationReportDrafts'
const dateFields = ['day', 'month', 'year']
const monthNames = new Map([
  ['jan', 1],
  ['january', 1],
  ['feb', 2],
  ['february', 2],
  ['mar', 3],
  ['march', 3],
  ['apr', 4],
  ['april', 4],
  ['may', 5],
  ['jun', 6],
  ['june', 6],
  ['jul', 7],
  ['july', 7],
  ['aug', 8],
  ['august', 8],
  ['sep', 9],
  ['sept', 9],
  ['september', 9],
  ['oct', 10],
  ['october', 10],
  ['nov', 11],
  ['november', 11],
  ['dec', 12],
  ['december', 12],
  ['ion', 1],
  ['ionawr', 1],
  ['chwe', 2],
  ['chwefror', 2],
  ['maw', 3],
  ['mawrth', 3],
  ['ebr', 4],
  ['ebrill', 4],
  ['mai', 5],
  ['meh', 6],
  ['mehefin', 6],
  ['gor', 7],
  ['gorffennaf', 7],
  ['aws', 8],
  ['awst', 8],
  ['med', 9],
  ['medi', 9],
  ['hyd', 10],
  ['hydref', 10],
  ['tach', 11],
  ['tachwedd', 11],
  ['rhag', 12],
  ['rhagfyr', 12]
])

const incompleteErrorKeys = {
  day: 'missingDay',
  month: 'missingMonth',
  year: 'missingYear',
  'day,month': 'missingDayMonth',
  'day,year': 'missingDayYear',
  'month,year': 'missingMonthYear',
  'day,month,year': 'missingDayMonthYear'
}

function normaliseValues(payload) {
  return {
    day: String(payload['vaccination-date-day'] ?? '').trim(),
    month: String(payload['vaccination-date-month'] ?? '').trim(),
    year: String(payload['vaccination-date-year'] ?? '').trim()
  }
}

function incompleteFields(values) {
  const fields = []

  if (!values.day) {
    fields.push('day')
  }
  if (!values.month || /^[a-z]{1,2}$/iu.test(values.month)) {
    fields.push('month')
  }
  if (!values.year || /^\d{1,3}$/.test(values.year)) {
    fields.push('year')
  }

  return fields
}

function parseMonth(month) {
  if (/^\d{1,2}$/.test(month)) {
    return Number(month)
  }

  return monthNames.get(month.toLocaleLowerCase('en-GB').replace(/\.$/, ''))
}

function isRealDate(day, month, year) {
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function isFutureDate(day, month, year, today) {
  const value = year * 10000 + month * 100 + day
  const todayValue =
    today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()

  return value > todayValue
}

export function validateVaccinationDate(values, today = new Date()) {
  if (dateFields.every((field) => !values[field])) {
    return { errorKey: 'empty', errorFields: dateFields }
  }

  const fieldsMissingInformation = incompleteFields(values)

  if (fieldsMissingInformation.length) {
    return {
      errorKey: incompleteErrorKeys[fieldsMissingInformation.join(',')],
      errorFields: fieldsMissingInformation
    }
  }

  const day = /^\d{1,2}$/.test(values.day) ? Number(values.day) : undefined
  const month = parseMonth(values.month)
  const year = /^\d{4}$/.test(values.year) ? Number(values.year) : undefined
  const invalidFields = []

  if (!day || day > 31) {
    invalidFields.push('day')
  }
  if (!month || month > 12) {
    invalidFields.push('month')
  }
  if (year === undefined || year === 0) {
    invalidFields.push('year')
  }

  if (invalidFields.length) {
    return {
      errorKey: 'invalid',
      errorFields: invalidFields.length === 1 ? invalidFields : dateFields
    }
  }

  if (!isRealDate(day, month, year)) {
    return { errorKey: 'invalid', errorFields: dateFields }
  }

  if (isFutureDate(day, month, year, today)) {
    return { errorKey: 'future', errorFields: dateFields }
  }

  return {
    value: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
}

function workOrderNotFound(request, h) {
  const message = request.t('pages.vaccinationDate.notFound')

  return h
    .view('error/index', {
      pageTitle: message,
      heading: statusCodes.notFound,
      message
    })
    .code(statusCodes.notFound)
}

async function getWorkOrder(workOrderSlug) {
  return backendRequest(`/workorders/${encodeURIComponent(workOrderSlug)}`)
}

function getFarmName(workOrder) {
  return (
    workOrder.cph?.locationName ||
    workOrder.cph?.cphCode ||
    workOrder.cphName ||
    workOrder.cphCode ||
    workOrder.id
  )
}

function valuesFromStoredDate(vaccinationDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(vaccinationDate ?? '')

  if (!match) {
    return { day: '', month: '', year: '' }
  }

  return { day: match[3], month: match[2], year: match[1] }
}

function buildDateInputItems(request, values, errorFields = []) {
  return dateFields.map((field) => ({
    name: field,
    label: request.t(`pages.vaccinationDate.${field}`),
    value: values[field],
    error: errorFields.includes(field),
    inputmode: field === 'month' ? 'text' : 'numeric'
  }))
}

function buildViewModel(request, workOrder, values, validation) {
  const farmName = getFarmName(workOrder)
  const title = request.t('pages.vaccinationDate.title')
  const errorMessage = validation?.errorKey
    ? request.t(`pages.vaccinationDate.errors.${validation.errorKey}`)
    : undefined

  return {
    pageTitle: errorMessage
      ? `${request.t('pages.vaccinationDate.errorPageTitlePrefix')}: ${title}`
      : title,
    farmName,
    workOrderSlug: request.params.workOrderSlug,
    workListId: request.params.workListId,
    dateInputItems: buildDateInputItems(
      request,
      values,
      validation?.errorFields
    ),
    errorMessage,
    errorHref: validation?.errorFields?.length
      ? `#vaccination-date-${validation.errorFields[0]}`
      : undefined
  }
}

async function renderVaccinationDate(request, h, values, validation) {
  const { workOrderSlug } = request.params
  let workOrder

  try {
    workOrder = await getWorkOrder(workOrderSlug)
  } catch (error) {
    if (error.statusCode !== statusCodes.notFound) {
      throw error
    }

    return workOrderNotFound(request, h)
  }

  const response = h.view(
    'report-vaccination/vaccination-date',
    buildViewModel(request, workOrder, values, validation)
  )

  return validation ? response.code(statusCodes.badRequest) : response
}

export const vaccinationDateController = {
  async handler(request, h) {
    const { workOrderSlug, workListId } = request.params
    const drafts = request.yar.get(sessionKey) ?? {}
    const storedDate = drafts[workOrderSlug]?.[workListId]?.vaccinationDate

    return renderVaccinationDate(request, h, valuesFromStoredDate(storedDate))
  }
}

export const saveVaccinationDateController = {
  async handler(request, h) {
    const values = normaliseValues(request.payload)
    const validation = validateVaccinationDate(values)

    if (validation.errorKey) {
      return renderVaccinationDate(request, h, values, validation)
    }

    const { workOrderSlug, workListId } = request.params
    const drafts = request.yar.get(sessionKey) ?? {}
    request.yar.set(sessionKey, {
      ...drafts,
      [workOrderSlug]: {
        ...drafts[workOrderSlug],
        [workListId]: { vaccinationDate: validation.value }
      }
    })

    return h
      .redirect(`/work-orders/${encodeURIComponent(workOrderSlug)}`)
      .code(303)
  }
}
