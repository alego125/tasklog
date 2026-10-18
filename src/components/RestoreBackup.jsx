import { useState } from 'react'
import Dialog from './Dialog.jsx'
import { api } from '../hooks/useApi.js'
export default function RestoreBackup({ onClose, onRestored }) {
  const [backup, setBackup] = useState(null)
  const [memberships, setMemberships] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const choose = async (event) => {
    setError(null)
    setBackup(null)
    const file = event.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      setError('El archivo supera el límite de 10 MB')
      return
    }
    try {
      const data = JSON.parse(await file.text())
      if (![1, 2].includes(data.version) || !data.data || !Array.isArray(data.data.projects))
        throw new Error()
      setBackup(data)
    } catch {
      setError('El archivo no tiene un formato de backup válido')
    }
  }
  const restore = async () => {
    setLoading(true)
    setError(null)
    try {
      setResult(await api.restore(backup, memberships))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }
  return (
    <Dialog onClose={loading ? () => {} : result ? onRestored : onClose} label="Importar backup">
      <h2>Importar backup</h2>
      <p>
        Se crearán copias nuevas de los proyectos, reuniones, tareas y notas. Los datos existentes
        se conservan. Importar el mismo archivo varias veces crea copias adicionales.
      </p>
      {result ? (
        <>
          <p role="status">
            Se importaron {result.restored.projects} proyectos, {result.restored.meetings} reuniones
            y {result.restored.tasks} tareas.
          </p>
          {result.warnings.legacy && (
            <p>El backup antiguo no contiene reuniones ni información de colaboración.</p>
          )}
          {result.warnings.missingMembers.length > 0 && (
            <p>
              No se encontraron {result.warnings.missingMembers.length} cuentas de colaboradores.
              Las copias siguen disponibles para vos.
            </p>
          )}
          <button onClick={onRestored}>Finalizar</button>
        </>
      ) : (
        <>
          <label>
            Archivo JSON{' '}
            <input
              type="file"
              accept=".json,application/json"
              onChange={choose}
              disabled={loading}
            />
          </label>
          {backup && (
            <p>
              {backup.data.projects.length} proyectos en el archivo (versión {backup.version}).
            </p>
          )}
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={memberships}
              onChange={(e) => setMemberships(e.target.checked)}
              disabled={loading}
            />{' '}
            Compartir las copias con las cuentas del backup que existan en esta aplicación.
          </label>
          {error && <p role="alert">{error}</p>}
          <div className="dialog-actions">
            <button onClick={onClose} disabled={loading}>
              Cancelar
            </button>
            <button onClick={restore} disabled={!backup || loading}>
              {loading ? 'Importando…' : 'Importar como copias'}
            </button>
          </div>
        </>
      )}
    </Dialog>
  )
}
