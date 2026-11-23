import {
  canonicalWorkOrderSlug,
  workOrderIdToSlug,
  workOrderSlugToId
} from './work-order-id.js'

describe('work order identifiers in URLs', () => {
  test('replaces spaces with underscores for URLs', () => {
    expect(workOrderIdToSlug('CV WorkOrder 1')).toBe('CV_WorkOrder_1')
  })

  test('restores spaces before calling the backend', () => {
    expect(workOrderSlugToId('CV_WorkOrder_1')).toBe('CV WorkOrder 1')
  })

  test('canonicalises old path parameters containing spaces', () => {
    expect(canonicalWorkOrderSlug('CV WorkOrder 1')).toBe('CV_WorkOrder_1')
  })
})
