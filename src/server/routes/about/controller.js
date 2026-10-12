/**
 * A GDS styled example about page controller.
 * Provided as an example, remove or modify as required.
 */
export const aboutController = {
  handler(request, h) {
    return h.view('about/index', {
      pageTitle: request.t('pages.about.title'),
      heading: request.t('pages.about.heading'),
      breadcrumbs: [
        {
          text: request.t('navigation.home'),
          href: '/'
        },
        {
          text: request.t('navigation.about')
        }
      ]
    })
  }
}
