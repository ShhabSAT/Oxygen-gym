/**
 * Reference-counted body scroll lock. Multiple overlays (ConfirmDialog,
 * BottomSheet) can be open at once; the body scroll is only released when
 * the last one closes.
 */

let lockCount = 0

export function lockScroll(): void {
  lockCount += 1
  if (lockCount === 1 && typeof document !== 'undefined') {
    document.body.style.overflow = 'hidden'
  }
}

export function unlockScroll(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0 && typeof document !== 'undefined') {
    document.body.style.overflow = ''
  }
}
