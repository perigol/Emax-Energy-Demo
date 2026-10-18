import { Body, Controller, Get, Post } from '@nestjs/common'
import { IsEmail, IsString, MinLength } from 'class-validator'
import { AuthService } from './auth.service'
import { Public, Require, type AuthUser } from './decorators'
import { CurrentUser } from './current-user'

class LoginDto {
  @IsEmail({}, { message: 'El correo no es válido' })
  email!: string

  @IsString()
  @MinLength(4, { message: 'La contraseña es demasiado corta' })
  password!: string
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password)
  }

  @Require('received')
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user
  }
}
