import { initCommon } from './common.js'

test('opens the browser print dialog when the print button is clicked', () => {
  const button = new EventTarget()
  const page = { print: vi.fn() }
  const document = {
    querySelector: (selector) =>
      selector === '[data-print-page]' ? button : null
  }

  initCommon(document, page)
  expect(page.print).not.toHaveBeenCalled()

  button.dispatchEvent(new Event('click'))
  expect(page.print).toHaveBeenCalledOnce()
})

test('does nothing when the print button is absent', () => {
  expect(() =>
    initCommon({ querySelector: () => null }, { print: vi.fn() })
  ).not.toThrow()
})
