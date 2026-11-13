export function initCommon(document, page) {
  const printButton = document.querySelector('[data-print-page]')
  if (printButton) {
    printButton.addEventListener('click', () => {
      page.print()
    })
  }
}
