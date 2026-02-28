const STYLES = {
  success: { bg:'#052e16', border:'#16a34a', icon:'✅', color:'#4ade80' },
  error:   { bg:'#2d0a0a', border:'#dc2626', icon:'❌', color:'#f87171' },
  warning: { bg:'#2d1f00', border:'#d97706', icon:'⚠️', color:'#fbbf24' },
  info:    { bg:'#0f172a', border:'#6366f1', icon:'ℹ️', color:'#818cf8' },
}

export default function Toast({ toasts, onDismiss }) {
  if (!toasts.length) return null

  return (
    <div style={{ position:'fixed', bottom:24, right:24, zIndex:9999, display:'flex', flexDirection:'column', gap:10, maxWidth:360, width:'calc(100vw - 48px)' }}>
      {toasts.map(t => {
        const s = STYLES[t.type] || STYLES.success
        return (
          <div
            key={t.id}
            style={{
              background: s.bg,
              border: `1px solid ${s.border}`,
              borderRadius: 10,
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              boxShadow: '0 8px 32px #00000066',
              animation: 'toastIn .2s ease',
            }}
          >
            <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>{s.icon}</span>
            <span style={{ fontSize:13, color: s.color, flex:1, lineHeight:1.5 }}>{t.message}</span>
            <button
              onClick={() => onDismiss(t.id)}
              style={{ background:'transparent', border:'none', color:'#64748b', cursor:'pointer', fontSize:16, padding:0, flexShrink:0, lineHeight:1 }}
            >✕</button>
          </div>
        )
      })}
      <style>{`
        @keyframes toastIn {
          from { opacity:0; transform:translateY(12px) }
          to   { opacity:1; transform:translateY(0) }
        }
      `}</style>
    </div>
  )
}
