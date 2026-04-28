const STYLES = {
  success: { bg:'#edf5ee', border:'#b0cdb2', icon:'✓', color:'#2c5e30' },
  error:   { bg:'#f5edec', border:'#cba8a8', icon:'✕', color:'#6e2828' },
  warning: { bg:'#faf0e6', border:'#c8a888', icon:'⚠', color:'#7a4820' },
  info:    { bg:'#edf0f8', border:'#b0b8d4', icon:'i', color:'#2a3a6e' },
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
              boxShadow: '0 4px 20px rgba(44,38,32,0.12)',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
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
