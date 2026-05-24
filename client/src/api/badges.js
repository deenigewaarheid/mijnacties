export function refreshBadges() {
  window.dispatchEvent(new CustomEvent('refresh-badges'))
}
