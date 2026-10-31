import {useEffect, useLayoutEffect} from 'react'

/**
 * `useLayoutEffect` in the browser so scroll-linked styles land before paint,
 * and `useEffect` during SSR to avoid React’s server-rendering warning.
 */
export const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect
