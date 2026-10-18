export function activateOnKeyboard(event) {
  if (event.target !== event.currentTarget || !['Enter', ' '].includes(event.key)) return
  event.preventDefault()
  event.currentTarget.dispatchEvent(new MouseEvent('click', { bubbles: true }))
}
