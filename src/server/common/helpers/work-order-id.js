export function workOrderIdToSlug(workOrderId) {
  return workOrderId.replaceAll(' ', '_')
}

export function workOrderSlugToId(workOrderSlug) {
  return workOrderSlug.replaceAll('_', ' ')
}

export function canonicalWorkOrderSlug(workOrderSlug) {
  return workOrderIdToSlug(workOrderSlugToId(workOrderSlug))
}
