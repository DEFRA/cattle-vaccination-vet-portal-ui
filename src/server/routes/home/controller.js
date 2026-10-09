/**
 * A GDS styled example home page controller.
 * Provided as an example, remove or modify as required.
 */
export const homeController = {
  handler(request, h) {
    return h.view('home/index', {
      pageTitle: request.t('pages.home.title'),
      heading: request.t('pages.home.heading')
    })
  }
}
