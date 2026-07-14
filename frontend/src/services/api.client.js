const TIMEOUT_MS = 10000

class ApiClient {
  constructor() { this._token = null }
  setToken(t)  { this._token = t }
  clearToken() { this._token = null }

  async _request(url, options = {}, extraHeaders = {}, isRetry = false) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    }
    if (this._token && !extraHeaders['Authorization']) {
      headers['Authorization'] = `Bearer ${this._token}`
    }

    try {
      const res = await fetch(url, { ...options, headers, signal: controller.signal })
      clearTimeout(timer)

      if (res.status === 204) return { success: true }
      
      // If 401 and not already retrying, try to refresh
      if (res.status === 401 && !isRetry && !url.includes('/auth/refresh') && !url.includes('/auth/login')) {
        const refreshed = await this._handleRefresh()
        if (refreshed) {
          return this._request(url, options, extraHeaders, true)
        }
      }

      const data = await res.json()
      if (!res.ok) {
        const err = new Error(data.message || `HTTP ${res.status}`)
        err.code   = data.error_code || data.code || 'API_ERROR'
        err.status = res.status
        err.data   = data
        throw err
      }
      return data
    } catch (err) {
      clearTimeout(timer)
      if (err.name === 'AbortError') {
        const t = new Error('La petición tardó demasiado')
        t.code = 'TIMEOUT'
        throw t
      }
      throw err
    }
  }

  async _handleRefresh() {
    if (this._refreshing) return this._refreshing
    
    this._refreshing = (async () => {
      try {
        const refreshToken = localStorage.getItem('crm_refresh')
        // We use the raw fetch here to avoid recursion
        const res = await fetch('/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        })
        if (!res.ok) throw new Error('Refresh failed')
        const data = await res.json()
        if (data.token) {
          this.setToken(data.token)
          // Also update localStorage
          localStorage.setItem('crm_token', data.token)
          if (data.refreshToken) {
            localStorage.setItem('crm_refresh', data.refreshToken)
          }
          return true
        }
        return false
      } catch (e) {
        this.clearToken()
        localStorage.removeItem('crm_token')
        localStorage.removeItem('crm_user')
        localStorage.removeItem('crm_refresh')
        localStorage.removeItem('crm_tenants')
        window.location.href = '/login?expired=1'
        return false
      } finally {
        this._refreshing = null
      }
    })()
    
    return this._refreshing
  }

  get(url, extraHeaders)         { return this._request(url, { method: 'GET' },    extraHeaders) }
  post(url, body, extraHeaders)  { return this._request(url, { method: 'POST',  body: JSON.stringify(body) }, extraHeaders) }
  put(url, body, extraHeaders)   { return this._request(url, { method: 'PUT',   body: JSON.stringify(body) }, extraHeaders) }
  patch(url, body, extraHeaders) { return this._request(url, { method: 'PATCH', body: JSON.stringify(body) }, extraHeaders) }
  delete(url, extraHeaders)      { return this._request(url, { method: 'DELETE' }, extraHeaders) }
}

export const api = new ApiClient()
export default api
