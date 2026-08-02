import { NextResponse } from 'next/server'

export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  errors?: string[]
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  // Handle BigInt serialization
  const serializedData = JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  )
  return NextResponse.json({ success: true, data: serializedData }, { status })
}

export function apiError(message: string, status = 400, errors?: string[]): NextResponse<ApiResponse> {
  return NextResponse.json({ success: false, error: message, errors }, { status })
}

export function apiUnauthorized(): NextResponse<ApiResponse> {
  return apiError('Unauthorized', 401)
}

export function apiForbidden(): NextResponse<ApiResponse> {
  return apiError('Forbidden: insufficient permissions', 403)
}

export function apiNotFound(entity = 'Resource'): NextResponse<ApiResponse> {
  return apiError(`${entity} not found`, 404)
}

export function apiServerError(err: unknown): NextResponse<ApiResponse> {
  console.error('[API Error]', err)
  const message = err instanceof Error ? err.message : 'An unexpected error occurred'
  return apiError(message, 500)
}
