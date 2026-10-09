export function buildNavigation(request) {
  return [
    {
      text: request?.t?.('navigation.home') ?? 'Home',
      href: '/',
      current: request?.path === '/'
    },
    {
      text: request?.t?.('navigation.about') ?? 'About',
      href: '/about',
      current: request?.path === '/about'
    }
  ]
}
