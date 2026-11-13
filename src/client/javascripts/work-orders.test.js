import { initWorkOrders } from './work-orders.js'

describe('initCreateWorkListForm', () => {
  let form
  let page
  let button
  let status

  beforeEach(() => {
    form = new EventTarget()
    page = new EventTarget()
    button = { disabled: false }
    status = { textContent: '' }
    form.dataset = { submittingMessage: 'Creating your vaccination list…' }
    form.querySelector = (selector) =>
      selector === 'button[type="submit"]' ? button : status
    initWorkOrders(
      {
        querySelector: (selector) =>
          selector === '[data-create-work-list-form]' ? form : null
      },
      page
    )
  })

  test('does nothing when work-order enhancements are absent', () => {
    expect(() =>
      initWorkOrders({ querySelector: () => null }, new EventTarget())
    ).not.toThrow()
  })

  test('allows the first submission and announces progress', () => {
    const event = new Event('submit', { cancelable: true })

    expect(form.dispatchEvent(event)).toBe(true)
    expect(button.disabled).toBe(true)
    expect(status.textContent).toBe('Creating your vaccination list…')
  })

  test('prevents subsequent submissions while waiting', () => {
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    const repeat = new Event('submit', { cancelable: true })

    expect(form.dispatchEvent(repeat)).toBe(false)
    expect(repeat.defaultPrevented).toBe(true)
  })

  test('does not show progress if submission was already cancelled', () => {
    const event = new Event('submit', { cancelable: true })
    event.preventDefault()

    form.dispatchEvent(event)

    expect(button.disabled).toBe(false)
    expect(status.textContent).toBe('')
  })

  test('restores the form when returning from the back-forward cache', () => {
    form.dispatchEvent(new Event('submit', { cancelable: true }))
    const event = new Event('pageshow')
    event.persisted = true
    page.dispatchEvent(event)

    expect(button.disabled).toBe(false)
    expect(status.textContent).toBe('')
    expect(form.dispatchEvent(new Event('submit', { cancelable: true }))).toBe(
      true
    )
  })
})
