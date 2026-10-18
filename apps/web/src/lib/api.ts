export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const base = () => process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = localStorage.getItem('nl_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${base()}${path}`, { ...options, headers })
  if (response.status === 401 && path !== '/auth/login') {
    localStorage.removeItem('nl_token')
    localStorage.removeItem('nl_user')
    if (window.location.pathname !== '/login') window.location.href = '/login'
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(response.status, data?.message || 'No se pudo completar la operación')
  }
  const type = response.headers.get('content-type') || ''
  if (type.includes('application/pdf') || type.startsWith('image/')) {
    return (await response.blob()) as T
  }
  return response.json() as Promise<T>
}
