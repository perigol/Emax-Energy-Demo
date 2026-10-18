import { SetMetadata } from '@nestjs/common'
import type { Action } from './permissions'

export const IS_PUBLIC = 'isPublic'
export const ACTIONS = 'actions'

export const Public = () => SetMetadata(IS_PUBLIC, true)
export const Require = (...actions: Action[]) => SetMetadata(ACTIONS, actions)

export interface AuthUser {
  sub: string
  email: string
  role: 'ADMIN' | 'GESTOR' | 'FACTURAS'
  name: string
}
