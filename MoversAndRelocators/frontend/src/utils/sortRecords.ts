export type SortDirection = 'asc' | 'desc'

export function sortRecords<T extends object>(rows: T[], field: keyof T, direction: SortDirection) {
  return [...rows].sort((left, right) => {
    const a = left[field]
    const b = right[field]
    if (a === b) return 0
    if (a === null || a === undefined) return 1
    if (b === null || b === undefined) return -1
    const result = typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
    return direction === 'asc' ? result : -result
  })
}
