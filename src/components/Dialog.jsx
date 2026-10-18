import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
export default function Dialog({ onClose, children, label = 'Editar datos', style }) {
  const ref = useRef(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      previous?.focus?.()
    }
  }, [])
  return createPortal(
    <dialog
      ref={ref}
      aria-label={label}
      className="ft-dialog"
      onCancel={(e) => {
        e.preventDefault()
        close.current()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close.current()
      }}
    >
      <div className="ft-modal-inner" style={style} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </dialog>,
    document.body
  )
}
