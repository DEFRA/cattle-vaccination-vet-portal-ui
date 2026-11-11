import {
  createAll,
  Button,
  Checkboxes,
  ErrorSummary,
  Radios,
  SkipLink
} from 'govuk-frontend'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(Radios)
createAll(SkipLink)

document
  .querySelector('[data-print-work-list]')
  ?.addEventListener('click', () => {
    window.print()
  })
