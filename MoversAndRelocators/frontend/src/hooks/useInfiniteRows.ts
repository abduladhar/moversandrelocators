import { UIEvent, useEffect, useMemo, useState } from 'react'

const PAGE_SIZE = 20

export function useInfiniteRows<T>(rows: T[], resetKey: string) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  useEffect(() => setVisibleCount(PAGE_SIZE), [resetKey, rows.length])
  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount])
  const onScroll = (event: UIEvent<HTMLElement>) => {
    const target = event.currentTarget
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 80 && visibleCount < rows.length) {
      setVisibleCount(count => Math.min(count + PAGE_SIZE, rows.length))
    }
  }
  return { visibleRows, onScroll, hasMore: visibleCount < rows.length }
}
