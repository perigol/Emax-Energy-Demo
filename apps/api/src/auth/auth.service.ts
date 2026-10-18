import { Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import bcrypt from 'bcryptjs'
import { loginSummary } from '../audit/describe'
import { AuditService } from '../audit/audit.service'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from './decorators'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async login(email: string, password: string) {
    const normalized = email.toLowerCase()
    const user = await this.prisma.user.findUnique({ where: { email: normalized } })
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      await this.audit.record({
        userId: user?.id,
        userName: user?.name || normalized,
        userEmail: normalized,
        summary: loginSummary(Boolean(user)),
      })
      throw new UnauthorizedException('Correo o contraseña incorrectos')
    }
    await this.audit.record({
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      summary: 'Entró en el libro',
    })
    const payload: AuthUser = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    }
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    }
  }
}
