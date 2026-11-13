import { format, isDate, parseISO } from 'date-fns'
import { cy } from 'date-fns/locale'

export function formatDate(
  value,
  formattedDateStr = 'EEE do MMMM yyyy',
  language = 'en'
) {
  const date = isDate(value) ? value : parseISO(value)

  return format(date, formattedDateStr, {
    locale: language === 'cy' ? cy : undefined
  })
}
