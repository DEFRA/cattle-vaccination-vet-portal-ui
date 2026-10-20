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
    },
    {
      text: request?.t?.('navigation.workOrders') ?? 'Work orders',
      href: '/work-orders',
      current: request?.path === '/work-orders'
    }
  ]
}
