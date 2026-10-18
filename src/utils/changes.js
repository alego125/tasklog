let channel
const listeners = new Set()
function receive() {
  for (const listener of listeners) listener()
}
export function subscribeChanges(listener) {
  if (!listeners.size) {
    window.addEventListener('tasklog_changed', receive)
    channel =
      typeof BroadcastChannel === 'function' ? new BroadcastChannel('tasklog_updates') : null
    if (channel) channel.onmessage = receive
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      window.removeEventListener('tasklog_changed', receive)
      channel?.close()
      channel = null
    }
  }
}
export function announceChange() {
  window.dispatchEvent(new Event('tasklog_changed'))
  channel?.postMessage('changed')
}
