import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface AuditEntry {
  userId?: string | null
  userName: string
  userEmail?: string | null
  summary: string
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(private prisma: PrismaService) {}

  async record(entry: AuditEntry) {
    try {
      await this.prisma.activityLog.create({
        data: {
          userId: entry.userId || null,
          userName: entry.userName.slice(0, 120) || 'Alguien',
          userEmail: (entry.userEmail || '').slice(0, 160),
          summary: entry.summary.slice(0, 240),
        },
      })
    } catch (error) {
      this.logger.error('No se pudo guardar la bitácora', error instanceof Error ? error.stack : undefined)
    }
  }

  list() {
    return this.prisma.activityLog.findMany({
      orderBy: { at: 'desc' },
      take: 200,
      select: { id: true, at: true, userName: true, userEmail: true, summary: true },
    })
  }
}
