import './load-env'
import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ApiExceptionFilter } from './http'
import { runSeed } from './seed/run'

async function bootstrap() {
  if (process.env.SEED_ON_BOOT !== 'false') {
    await runSeed()
  }
  const app = await NestFactory.create(AppModule)
  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map((item) => item.trim()),
    credentials: true,
  })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )
  app.useGlobalFilters(new ApiExceptionFilter())
  const port = Number(process.env.PORT || 3001)
  await app.listen(port)
  console.log(`API en http://localhost:${port}`)
}

bootstrap()
