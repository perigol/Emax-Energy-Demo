import { CallHandler, ExecutionContext, HttpException, Injectable, NestInterceptor } from '@nestjs/common'
import { catchError, tap, throwError, type Observable } from 'rxjs'
import type { AuthUser } from '../auth/decorators'
import { AuditService } from './audit.service'
import { describeAction } from './describe'

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string
      originalUrl?: string
      url?: string
      user?: AuthUser
      body?: unknown
    }>()
    const method = request.method || 'GET'
    const path = (request.originalUrl || request.url || '').split('?')[0]
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method) || path.startsWith('/auth/') || path.startsWith('/internal/')) {
      return next.handle()
    }
    const actor = {
      userId: request.user?.sub,
      userName: request.user?.name || 'Alguien',
      userEmail: request.user?.email || '',
    }
    return next.handle().pipe(
      tap((body) => {
        void this.audit.record({ ...actor, summary: describeAction(method, path, body, request.body) })
      }),
      catchError((error: unknown) => {
        const message = error instanceof HttpException ? messageOf(error) : 'La operación no se completó'
        const action = describeAction(method, path, undefined, request.body).replace(/:.*/, '')
        void this.audit.record({ ...actor, summary: `No se completó (${action}). ${message}`.slice(0, 240) })
        return throwError(() => error)
      }),
    )
  }
}

function messageOf(error: HttpException): string {
  const response = error.getResponse()
  if (typeof response === 'string') return response
  if (response && typeof response === 'object' && 'message' in response) {
    const message = (response as { message?: string | string[] }).message
    return Array.isArray(message) ? message[0] || error.message : message || error.message
  }
  return error.message
}
