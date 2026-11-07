import axios from 'axios'

const rawBase = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD
    ? 'https://tnn1ahid34.execute-api.ap-southeast-2.amazonaws.com'
    : 'http://localhost:3000')
).replace(/\/+$/, '')

const BASE_URL = rawBase.endsWith('/api') ? rawBase : `${rawBase}/api`

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
})

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('token')
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/share')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
