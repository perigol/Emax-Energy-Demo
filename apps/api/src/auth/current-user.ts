import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { AuthUser } from './decorators'

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  return ctx.switchToHttp().getRequest<{ user: AuthUser }>().user
})
