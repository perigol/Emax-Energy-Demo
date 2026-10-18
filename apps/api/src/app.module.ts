import { Module } from '@nestjs/common'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { AuditController, AuditModule } from './audit/audit.module'
import { AuditInterceptor } from './audit/audit.interceptor'
import { AuthModule } from './auth/auth.module'
import { JwtAuthGuard, RolesGuard } from './auth/guards'
import { BanksController } from './banks/banks.module'
import { ContactsController } from './contacts/contacts.module'
import { ExpensesController } from './expenses/expenses.module'
import { HealthController } from './http'
import { IssuedController } from './issued/issued.module'
import { PaymentsService } from './payments/payments.service'
import { PrismaModule } from './prisma/prisma.module'
import { ReceivedController } from './received/received.module'
import { ServicesController } from './services/services.module'
import { SettingsController } from './settings/settings.module'
import { TaxController } from './tax/tax.module'
import { UsersController } from './users/users.module'

@Module({
  imports: [PrismaModule, AuditModule, AuthModule],
  controllers: [
    HealthController,
    AuditController,
    ContactsController,
    ServicesController,
    IssuedController,
    ReceivedController,
    ExpensesController,
    BanksController,
    TaxController,
    SettingsController,
    UsersController,
  ],
  providers: [
    PaymentsService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
