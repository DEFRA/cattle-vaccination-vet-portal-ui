export const cookiesController = {
  handler(request, h) {
    return h.view('cookies/index', {
      pageTitle: request.t('pages.cookies.title')
    })
  }
}
