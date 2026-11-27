import { format } from 'date-fns'

import { statusCodes } from '#/server/common/constants/status-codes.js'
import { backendRequest } from '#/server/common/helpers/backend-client.js'
import { dateFields, dateParts } from '#/server/common/validation/date-parts.js'

const sessionKey = 'vaccinationReportDrafts'
const dateInputId = 'vaccination-date'
const dateFieldIds = Object.fromEntries(
  dateFields.map((part) => [part, `${dateInputId}-${part}`])
)
const allDateFieldIds = Object.values(dateFieldIds)
const incompleteErrorKeys = {
  day: 'missingDay',
  month: 'missingMonth',
  year: 'missingYear',
  'day,month': 'missingDayMonth',
  'day,year': 'missingDayYear',
  'month,year': 'missingMonthYear',
  'day,month,year': 'missingDayMonthYear'
}

export function validateVaccinationDate(payload, today = new Date()) {
  const values = Object.fromEntries(
    allDateFieldIds.map((field) => [field, payload[field]])
  )
  const schema = dateParts({
    namePrefix: dateInputId,
    max: format(today, 'yyyy-MM-dd')
  })
  const { error, value } = schema.validate(values, { abortEarly: false })

  if (!error) {
    return { value }
  }

  if (
    allDateFieldIds.every((field) => {
      const value = values[field] ?? ''
      return typeof value === 'string' && !value.trim()
    })
  ) {
    return { errorKey: 'empty', errorFields: allDateFieldIds }
  }

  const incompleteFields = error.details
    .filter(({ type }) => type === 'any.required')
    .map(({ path }) => path[0])

  if (incompleteFields.length) {
    const incompleteParts = dateFields.filter((part) =>
      incompleteFields.includes(dateFieldIds[part])
    )

    return {
      errorKey: incompleteErrorKeys[incompleteParts.join(',')],
      errorFields: incompleteFields
    }
  }

  const [firstError] = error.details
  return {
    errorKey: firstError.type === 'date.max' ? 'future' : 'invalid',
    errorFields:
      error.details.length === 1 && firstError.path.length
        ? firstError.path
        : allDateFieldIds
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
  const match = /^(\d{1,4})-(\d{2})-(\d{2})$/.exec(vaccinationDate ?? '')

  if (!match) {
    return {}
  }

  return {
    [dateFieldIds.day]: match[3],
    [dateFieldIds.month]: match[2],
    [dateFieldIds.year]: match[1].padStart(4, '0')
  }
}

function buildDateInputItems(request, values, errorFields = []) {
  return Object.entries(dateFieldIds).map(([part, id]) => ({
    name: part,
    label: request.t(`pages.vaccinationDate.${part}`),
    value: typeof values[id] === 'string' ? values[id] : '',
    error: errorFields.includes(id),
    inputmode: part === 'month' ? 'text' : 'numeric'
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
    dateInputId,
    dateInputItems: buildDateInputItems(
      request,
      values,
      validation?.errorFields
    ),
    errorMessage,
    errorHref: validation?.errorFields?.length
      ? `#${validation.errorFields[0]}`
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
    const values = request.payload ?? {}
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
