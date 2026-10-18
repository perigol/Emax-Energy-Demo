import {
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { ACTIONS, IS_PUBLIC, type AuthUser } from './decorators'
import { can, type Action } from './permissions'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(@Inject(Reflector) private reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    return super.canActivate(context)
  }

  handleRequest<T>(err: Error | null, user: T): T {
    if (err || !user) {
      throw new UnauthorizedException('Sesión no válida')
    }
    return user
  }
}

@Injectable()
export class RolesGuard {
  constructor(@Inject(Reflector) private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true
    const actions = this.reflector.getAllAndOverride<Action[]>(ACTIONS, [
      context.getHandler(),
      context.getClass(),
    ])
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>()
    const role = request.user?.role
    if (!role || !actions?.length || !actions.every((action) => can(role, action))) {
      throw new ForbiddenException('No tienes permiso para esta operación')
    }
    return true
  }
}
