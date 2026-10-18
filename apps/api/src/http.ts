import {
  ArgumentsHost,
  Catch,
  Controller,
  ExceptionFilter,
  Get,
  Headers,
  HttpException,
  NotFoundException,
  Post,
  UnauthorizedException,
} from '@nestjs/common'
import type { Response } from 'express'
import { Public } from './auth/decorators'
import { runSeed } from './seed/run'

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() {
    return { ok: true }
  }

  @Public()
  @Post('internal/reseed')
  async reseed(@Headers('x-reseed-token') token?: string) {
    const expected = process.env.RESEED_TOKEN
    if (!expected) throw new NotFoundException()
    if (token !== expected) throw new UnauthorizedException('Token no válido')
    await runSeed({ force: true })
    return { ok: true }
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const body = exception.getResponse()
      const raw =
        typeof body === 'string'
          ? body
          : Array.isArray((body as { message?: string[] }).message)
            ? (body as { message: string[] }).message.join('. ')
            : (body as { message?: string }).message || exception.message
      response.status(status).json({ message: inSpanish(raw, exception) })
      return
    }
    if ((exception as { code?: string }).code === 'LIMIT_FILE_SIZE') {
      response.status(400).json({ message: 'El archivo supera el tamaño permitido' })
      return
    }
    console.error(exception)
    response.status(500).json({ message: 'Error interno' })
  }
}

function inSpanish(message: string, exception: unknown) {
  if (message === 'File too large' || (exception as { code?: string }).code === 'LIMIT_FILE_SIZE') {
    return 'El archivo supera el tamaño permitido'
  }
  return message
}
