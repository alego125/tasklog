// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, renderHook, act, waitFor, cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { api, collection } from '../src/hooks/useApi.js'
import { getStatus, fmtDate, localDate } from '../src/utils/dates.js'
import { useSyncedCollection } from '../src/hooks/useSyncedCollection.js'
import PasswordInput from '../src/components/PasswordInput.jsx'
import AuthScreen from '../src/components/AuthScreen.jsx'
beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data })
describe('API errors and sessions', () => {
  it('rejects invalid login with the server message without deleting another session', async () => {
    localStorage.setItem('ft_token', 'existing')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ error: 'Usuario o contraseña incorrectos' }, 401))
    )
    await expect(api.login('alice', 'wrong')).rejects.toMatchObject({
      status: 401,
      message: 'Usuario o contraseña incorrectos',
    })
    expect(localStorage.getItem('ft_token')).toBe('existing')
  })
  it('clears an expired session and throws instead of resolving undefined', async () => {
    localStorage.setItem('ft_token', 'expired')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ error: 'Sesión expirada' }, 401)))
    await expect(api.me()).rejects.toMatchObject({ status: 401 })
    expect(localStorage.getItem('ft_token')).toBe(null)
  })
  it('does not let a stale response delete a newly authenticated session', async () => {
    let resolve
    localStorage.setItem('ft_token', 'old')
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((r) => {
            resolve = r
          })
      )
    )
    const pending = api.me()
    localStorage.setItem('ft_token', 'new')
    resolve(response({ error: 'expired' }, 401))
    await expect(pending).rejects.toMatchObject({ status: 401 })
    expect(localStorage.getItem('ft_token')).toBe('new')
  })
  it('collects every page for complete filters and exports', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(response({ items: [{ id: 1 }], nextCursor: 1 }))
        .mockResolvedValueOnce(response({ items: [{ id: 2 }], nextCursor: null }))
    )
    expect(await collection('/projects')).toEqual([{ id: 1 }, { id: 2 }])
    expect(fetch.mock.calls[1][0]).toContain('after=1')
  })
  it('shows a useful login error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response({ error: 'Usuario o contraseña incorrectos' }, 401))
    )
    render(<AuthScreen onAuth={vi.fn()} />)
    await userEvent.type(screen.getByLabelText('Usuario'), 'alice')
    await userEvent.type(screen.getByLabelText('Contraseña'), 'wrong')
    await userEvent.click(screen.getAllByRole('button', { name: 'Iniciar sesión' }).at(-1))
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Usuario o contraseña incorrectos'
    )
  })
})
describe('confirmed writes and synchronization', () => {
  it('a failed operation does not undo a later successful edit', async () => {
    localStorage.setItem('ft_token', 'token')
    const { result } = renderHook(() =>
      useSyncedCollection(async () => [{ id: 1, title: 'original' }])
    )
    await act(() => result.current.load())
    let reject
    let failed, later
    act(() => {
      failed = result.current
        .mutate(
          () =>
            new Promise((_, r) => {
              reject = r
            }),
          () => [{ id: 1, title: 'bad' }]
        )
        .catch((e) => e)
      later = result.current.mutate(
        async () => ({ title: 'saved' }),
        (items, row) => items.map((x) => ({ ...x, ...row }))
      )
    })
    await waitFor(() => expect(reject).toBeTypeOf('function'))
    await act(async () => {
      reject(new Error('offline'))
      await failed
      await later
    })
    expect(result.current.items).toEqual([{ id: 1, title: 'saved' }])
    expect(result.current.pending).toBe(0)
  })
  it('discards a refresh response older than a committed edit', async () => {
    localStorage.setItem('ft_token', 'token')
    let resolve
    const { result } = renderHook(() =>
      useSyncedCollection(
        () =>
          new Promise((r) => {
            resolve = r
          })
      )
    )
    let loading
    act(() => {
      loading = result.current.load(true)
    })
    await act(async () => {
      await result.current.mutate(
        async () => ({ id: 1, title: 'new' }),
        (_, row) => [row]
      )
    })
    await act(async () => {
      resolve([{ id: 1, title: 'old' }])
      await loading
    })
    expect(result.current.items[0].title).toBe('new')
  })
})
describe('queued session changes', () => {
  it('does not execute queued work under a different account', async () => {
    localStorage.setItem('ft_token', 'alice')
    const { result } = renderHook(() => useSyncedCollection(async () => []))
    let finish
    let first, second
    const operation = vi.fn(async () => 'bob must not run this')
    act(() => {
      first = result.current
        .mutate(
          () =>
            new Promise((resolve) => {
              finish = resolve
            })
        )
        .catch((e) => e)
      second = result.current.mutate(operation).catch((e) => e)
    })
    await waitFor(() => expect(finish).toBeTypeOf('function'))
    localStorage.setItem('ft_token', 'bob')
    await act(async () => {
      finish('old result')
      await first
      await second
    })
    expect(operation).not.toHaveBeenCalled()
    expect(result.current.items).toEqual([])
    expect(result.current.pending).toBe(0)
  })
})

describe('dates and keyboard controls', () => {
  it('keeps tasks valid through their due date', () => {
    expect(getStatus('2026-10-16', false, '2026-10-16')).toBe('warning')
    expect(getStatus('2026-10-15', false, '2026-10-16')).toBe('overdue')
    expect(getStatus('2026-10-20', false, '2026-10-16')).toBe('ok')
  })
  it('formats UTC and offset instants consistently in the business timezone', () => {
    expect(localDate('2026-10-17T01:00:00Z')).toBe('2026-10-16')
    expect(fmtDate('2026-10-16T22:00:00-03:00')).toBe('16/10/2026 22:00')
    expect(fmtDate('2026-10-17 01:00:00')).toBe('16/10/2026 22:00')
  })
  it('allows password visibility to be toggled using the keyboard', async () => {
    render(<PasswordInput value="secret" onChange={() => {}} />)
    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' })
    toggle.focus()
    await userEvent.keyboard('{Enter}')
    expect(
      screen.getByRole('button', { name: 'Ocultar contraseña' }).getAttribute('aria-pressed')
    ).toBe('true')
  })
})
