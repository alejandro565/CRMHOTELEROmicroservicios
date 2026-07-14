import React, { createContext, useContext, useState, useCallback } from 'react'
import api from '../services/api.client'
import ENDPOINTS from '../config/api.config'
import { normalizePermissions } from '../config/access'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,  setUser]  = useState(() => { try { return JSON.parse(localStorage.getItem('crm_user')) } catch { return null } })
  const [token, setToken] = useState(() => localStorage.getItem('crm_token'))

  // Holds the hotel list + selection_token when the user has multiple hotels.
  // Shape: { selection_token, user, tenants[] }
  // Cleared after selectHotel() or on logout.
  const [pendingSelection, setPendingSelection] = useState(null)

  // List of hotels the user owns — populated after login or hotel switch.
  // Used by Sidebar to show the "switch hotel" button.
  const [ownedTenants, setOwnedTenants] = useState(() => {
    try { return JSON.parse(localStorage.getItem('crm_tenants')) || [] } catch { return [] }
  })

  if (token) api.setToken(token)

  // ── Login ─────────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    const data = await api.post(ENDPOINTS.auth.login(), { email, password })

    // Store tenants list if provided (useful for owners even with 1 hotel)
    if (data.tenants) {
      setOwnedTenants(data.tenants)
      localStorage.setItem('crm_tenants', JSON.stringify(data.tenants))
    }

    // Multiple hotels — show selector screen
    if (data.requires_hotel_selection) {
      setPendingSelection({
        selection_token: data.selection_token,
        user:            data.user,
        tenants:         data.tenants,
      })
      return data
    }

    // Single hotel — go straight to dashboard
    _storeSession(data)
    return data
  }, [])

  // ── selectHotel ───────────────────────────────────────────────────────────────
  // Called from HotelSelectorPage — uses the short-lived selection_token.
  const selectHotel = useCallback(async (tenant_id) => {
    if (!pendingSelection) throw new Error('No hay selección pendiente')

    const data = await api.post(
      ENDPOINTS.auth.switchTenant(),
      { tenant_id },
      { Authorization: `Bearer ${pendingSelection.selection_token}` }
    )

    _storeSession(data)
    setPendingSelection(null)
    return data
  }, [pendingSelection])

  // ── switchHotel ───────────────────────────────────────────────────────────────
  // Called from the Sidebar when the user is already logged in and wants to
  // switch to another hotel without logging out.
  // Uses the current access token to re-authenticate and get a new one.
  const switchHotel = useCallback(async (tenant_id) => {
    // Re-login flow: request a new selection token by calling login again
    // would require the password. Instead we use the stored refresh token
    // to get a selection token via a dedicated endpoint.
    const refreshToken = localStorage.getItem('crm_refresh')
    if (!refreshToken) throw new Error('Sesión expirada, inicia sesión nuevamente')

    const data = await api.post(
      ENDPOINTS.auth.switchTenant(),
      { tenant_id, refresh_token: refreshToken }
    )

    _storeSession(data)
    return data
  }, [])

  // ── Logout ────────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const refresh = localStorage.getItem('crm_refresh')
      await api.post(ENDPOINTS.auth.logout(), { refreshToken: refresh })
    } catch {}
    api.clearToken()
    setToken(null)
    setUser(null)
    setPendingSelection(null)
    setOwnedTenants([])
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    localStorage.removeItem('crm_refresh')
    localStorage.removeItem('crm_tenants')
  }, [])

  const hasPermission = useCallback((slug) => {
    if (!user) return false
    return normalizePermissions(user).includes(slug)
  }, [user])

  const refreshPendingSelection = useCallback(async () => {
    // Refresh the list of hotels from the API
    const data = await api.get(ENDPOINTS.saas.myHotels())
    const freshTenants = data.data || data

    // Update global state
    setOwnedTenants(freshTenants)
    localStorage.setItem('crm_tenants', JSON.stringify(freshTenants))

    // If we're in the middle of a login selection, update that too
    if (pendingSelection) {
      setPendingSelection(prev => ({
        ...prev,
        tenants: freshTenants
      }))
    }
  }, [pendingSelection])

  // ── Private ───────────────────────────────────────────────────────────────────
  function _storeSession(data) {
    const accessToken = data.token || data.accessToken
    api.setToken(accessToken)
    setToken(accessToken)

    const sessionUser = {
      ...data.user,
      permissions: data.access?.permissions || [],
      modules: data.access?.modules || []
    }

    setUser(sessionUser)
    localStorage.setItem('crm_token', accessToken)
    localStorage.setItem('crm_user',  JSON.stringify(sessionUser))
    if (data.refreshToken) localStorage.setItem('crm_refresh', data.refreshToken)
  }

  return (
    <AuthContext.Provider value={{
      user, token, login, logout,
      selectHotel, switchHotel, refreshPendingSelection,
      pendingSelection, ownedTenants,
      hasPermission,
      isAuthenticated: !!token,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
