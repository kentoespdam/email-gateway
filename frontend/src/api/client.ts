import axios from 'axios'

/** Shared API client. Cookie auth: withCredentials sends the HttpOnly session cookie. */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
})

export default api
