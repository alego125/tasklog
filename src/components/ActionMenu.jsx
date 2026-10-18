import { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
export default function ActionMenu({ label = 'Más acciones', items }) {
  const [open, setOpen] = useState(false),
    ref = useRef(null),
    trigger = useRef(null)
  useEffect(() => {
    if (!open) return
    ref.current.querySelector('[role="menuitem"]')?.focus()
    const pointer = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', pointer)
    return () => document.removeEventListener('pointerdown', pointer)
  }, [open])
  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }
  const key = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    }
    const options = [...ref.current.querySelectorAll('[role="menuitem"]')]
    const index = options.indexOf(document.activeElement)
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) && open) {
      e.preventDefault()
      options[
        e.key === 'Home'
          ? 0
          : e.key === 'End'
            ? options.length - 1
            : (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) %
              options.length
      ]?.focus()
    }
  }
  return (
    <div
      className="action-menu"
      ref={ref}
      onKeyDown={key}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={trigger}
        className="icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Icon name="more" />
      </button>
      {open && (
        <div className="menu-panel" role="menu" aria-label={label}>
          {items.filter(Boolean).map((item) => (
            <button
              type="button"
              role="menuitem"
              className={item.danger ? 'danger' : ''}
              key={item.label}
              onClick={() => {
                close()
                item.onClick()
              }}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
