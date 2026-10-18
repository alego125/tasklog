import { useArchivedCollection } from './useArchivedCollection.js'
import { api } from './useApi.js'
import { useSyncedCollection } from './useSyncedCollection.js'
export function useMeetings() {
  const state = useSyncedCollection(() => api.getMeetings())
  const archived = useArchivedCollection(() => api.getArchivedMeetings())
  const {
    items: archivedMeetings,
    setItems: setArchivedMeetings,
    loading: loadingArchived,
    error: archiveError,
    load: loadArchivedMeetings,
  } = archived
  const replace = (items, m) => items.map((x) => (x.id === m.id ? m : x))
  const doAddMeeting = (name, color) =>
    state.mutate(
      () => api.createMeeting(name.trim(), color),
      (items, m) => [...items, m]
    )
  const doSaveEditMeeting = (meeting, name, color) =>
    state.mutate(() => api.updateMeeting(meeting.id, name, color), replace)
  const doArchiveMeeting = (id) =>
    state.mutate(
      () => api.archiveMeeting(id),
      (items) => items.filter((m) => m.id !== id)
    )
  const doUnarchiveMeeting = (id) =>
    state.mutate(
      async () => {
        const m = await api.unarchiveMeeting(id)
        setArchivedMeetings((prev) => prev.filter((x) => x.id !== id))
        return m
      },
      (items, m) => [...items, m]
    )
  const doDeleteMeeting = (id) =>
    state.mutate(
      async () => {
        const r = await api.deleteMeeting(id)
        setArchivedMeetings((prev) => prev.filter((x) => x.id !== id))
        return r
      },
      (items) => items.filter((m) => m.id !== id)
    )
  return {
    meetings: state.items,
    setMeetings: state.setItems,
    loading: state.loading,
    error: state.error,
    pending: state.pending,
    archivedMeetings,
    loadingArchived,
    archiveError,
    loadMeetings: state.load,
    loadArchivedMeetings,
    doAddMeeting,
    doSaveEditMeeting,
    doArchiveMeeting,
    doUnarchiveMeeting,
    doDeleteMeeting,
  }
}
