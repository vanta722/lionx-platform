import { RefObject, useEffect, useState } from 'react'

export function usePageVisible() {
  const [isPageVisible, setIsPageVisible] = useState(() => {
    if (typeof document === 'undefined') return true
    return document.visibilityState === 'visible'
  })

  useEffect(() => {
    if (typeof document === 'undefined') return

    const onVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible')
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  return isPageVisible
}

export function useInViewport<T extends Element>(
  ref: RefObject<T>,
  options?: IntersectionObserverInit
) {
  const [isInViewport, setIsInViewport] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      setIsInViewport(true)
      return
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsInViewport(entry.isIntersecting)
    }, options)

    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, options?.root, options?.rootMargin, options?.threshold])

  return isInViewport
}
