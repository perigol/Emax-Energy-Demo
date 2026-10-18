import { Controller, Get, Module } from '@nestjs/common'
import { Require } from '../auth/decorators'
import { AuditService } from './audit.service'

@Controller('audit')
export class AuditController {
  constructor(private audit: AuditService) {}

  @Require('audit')
  @Get()
  list() {
    return this.audit.list()
  }
}

@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
