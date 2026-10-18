import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common'
import { Role } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { assertPassword, LIMIT } from '../common/check'
import { PrismaService } from '../prisma/prisma.service'
import { CurrentUser } from '../auth/current-user'
import { Require, type AuthUser } from '../auth/decorators'

class UserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(LIMIT.name)
  name!: string

  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(LIMIT.email)
  email!: string

  @IsIn(['ADMIN', 'GESTOR', 'FACTURAS'])
  role!: Role

  @IsOptional()
  @IsString()
  @MinLength(8, {
    message: 'La contraseña necesita entre 8 y 72 caracteres, con mayúscula, minúscula, un número y un símbolo.',
  })
  @MaxLength(LIMIT.password, {
    message: 'La contraseña necesita entre 8 y 72 caracteres, con mayúscula, minúscula, un número y un símbolo.',
  })
  password?: string
}

@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Require('users')
  @Get()
  list() {
    return this.prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    })
  }

  @Require('users')
  @Post()
  async create(@Body() body: UserDto) {
    if (!body.password) throw new BadRequestException('La contraseña es obligatoria')
    assertPassword(body.password)
    const email = body.email.toLowerCase()
    const exists = await this.prisma.user.findUnique({ where: { email } })
    if (exists) throw new BadRequestException('Ese correo ya tiene cuenta')
    return this.prisma.user.create({
      data: {
        name: body.name.trim(),
        email,
        role: body.role,
        passwordHash: await bcrypt.hash(body.password, 10),
      },
      select: { id: true, name: true, email: true, role: true },
    })
  }

  @Require('users')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: UserDto, @CurrentUser() actor: AuthUser) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Usuario no encontrado')
    if (actor.sub === id && body.role !== 'ADMIN') {
      throw new BadRequestException('No puedes quitarte el rol de administrador')
    }
    if (body.password) assertPassword(body.password)
    const email = body.email.toLowerCase()
    const duplicate = await this.prisma.user.findFirst({ where: { email, NOT: { id } } })
    if (duplicate) throw new BadRequestException('Ese correo ya tiene cuenta')
    return this.prisma.user.update({
      where: { id },
      data: {
        name: body.name.trim(),
        email,
        role: body.role,
        ...(body.password ? { passwordHash: await bcrypt.hash(body.password, 10) } : {}),
      },
      select: { id: true, name: true, email: true, role: true },
    })
  }
}
