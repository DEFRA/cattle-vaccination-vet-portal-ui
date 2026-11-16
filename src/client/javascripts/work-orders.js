export function initWorkOrders(document, page) {
  const form = document.querySelector('[data-create-work-list-form]')
  if (form) {
    initCreateWorkListForm(form, page)
  }
}

function initCreateWorkListForm(form, page) {
  const button = form.querySelector('button[type="submit"]')
  const status = form.querySelector('[data-create-work-list-status]')
  let submitting = false

  form.addEventListener('submit', (event) => {
    if (submitting) {
      event.preventDefault()
      return
    }

    if (event.defaultPrevented) {
      return
    }

    submitting = true
    button.disabled = true
    status.textContent = form.dataset.submittingMessage
  })

  page.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      submitting = false
      button.disabled = false
      status.textContent = ''
    }
  })
}
