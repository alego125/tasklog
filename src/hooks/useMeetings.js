import { useState, useCallback } from 'react'
import { api } from './useApi.js'

export function useMeetings() {
  const [meetings,         setMeetings]         = useState([])
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState(null)
  const [archivedMeetings, setArchivedMeetings] = useState([])
  const [loadingArchived,  setLoadingArchived]  = useState(false)

  const loadMeetings = useCallback(async () => {
    if (!localStorage.getItem('ft_token')) { setLoading(false); return }
    try {
      setLoading(true); setError(null)
      setMeetings(await api.getMeetings())
    } catch {
      setError('No se pudo conectar con el servidor.')
    } finally { setLoading(false) }
  }, [])

  const loadArchivedMeetings = async () => {
    setLoadingArchived(true)
    try { setArchivedMeetings(await api.getArchivedMeetings()) }
    finally { setLoadingArchived(false) }
  }

  const doAddMeeting = async (name, color) => {
    if (!name.trim()) return
    const meeting = await api.createMeeting(name, color)
    setMeetings(prev => [...prev, meeting])
    return meeting
  }

  const doSaveEditMeeting = async (meeting, name, color) => {
    const prevVals = { name: meeting.name, color: meeting.color }
    setMeetings(ms => ms.map(m => m.id===meeting.id ? { ...m, name, color } : m))
    try { await api.updateMeeting(meeting.id, name, color) }
    catch(e) { setMeetings(ms => ms.map(m => m.id===meeting.id ? { ...m, ...prevVals } : m)); throw e }
  }

  const doArchiveMeeting = async mId => {
    const snapshot = meetings
    setMeetings(prev => prev.filter(m => m.id !== mId))
    try { await api.archiveMeeting(mId) }
    catch(e) { setMeetings(snapshot); throw e }
  }

  const doUnarchiveMeeting = async mId => {
    const meeting = await api.unarchiveMeeting(mId)
    setArchivedMeetings(prev => prev.filter(m => m.id !== mId))
    setMeetings(prev => [...prev, meeting])
  }

  const doDeleteMeeting = async mId => {
    const snapshot = meetings
    setMeetings(prev => prev.filter(m => m.id !== mId))
    try { await api.deleteMeeting(mId) }
    catch(e) { setMeetings(snapshot); throw e }
  }

  return {
    meetings, setMeetings, loading, error, archivedMeetings, loadingArchived,
    loadMeetings, loadArchivedMeetings,
    doAddMeeting, doSaveEditMeeting, doArchiveMeeting, doUnarchiveMeeting, doDeleteMeeting,
  }
}
