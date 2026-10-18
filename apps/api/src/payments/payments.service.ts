import { BadRequestException, Injectable } from '@nestjs/common'
import { PayDirection, Prisma } from '@prisma/client'
import { asNumber, cents, money, utcDay } from '../common/money'
import { euroLimit, MAX_MONEY } from '../common/check'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  async collectIssued(id: string, amount: number, date: string, bankAccountId?: string) {
    const invoice = await this.prisma.issuedInvoice.findUnique({ where: { id } })
    if (!invoice) throw new BadRequestException('Factura no encontrada')
    if (invoice.status === 'BORRADOR' || invoice.rectifiesId) {
      throw new BadRequestException('Este documento no admite un cobro')
    }
    return this.settle({
      amount,
      date,
      bankAccountId,
      direction: 'IN',
      total: asNumber(invoice.total),
      paid: asNumber(invoice.paidAmount),
      link: { issuedInvoiceId: id },
      apply: (tx, paidAmount, status) =>
        tx.issuedInvoice.update({
          where: { id },
          data: { paidAmount, status: status === 'PAGADA' ? 'COBRADA' : 'COBRADA_PARCIAL' },
        }),
    })
  }

  async payReceived(id: string, amount: number, date: string, bankAccountId?: string) {
    const invoice = await this.prisma.receivedInvoice.findUnique({ where: { id } })
    if (!invoice) throw new BadRequestException('Factura no encontrada')
    if (invoice.status === 'BORRADOR') throw new BadRequestException('El borrador no se puede pagar')
    return this.settle({
      amount,
      date,
      bankAccountId,
      direction: 'OUT',
      total: asNumber(invoice.total),
      paid: asNumber(invoice.paidAmount),
      link: { receivedInvoiceId: id },
      apply: (tx, paidAmount, status) =>
        tx.receivedInvoice.update({
          where: { id },
          data: { paidAmount, status: status === 'PAGADA' ? 'PAGADA' : 'REGISTRADA' },
        }),
    })
  }

  async payExpense(id: string, amount: number, date: string, bankAccountId?: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } })
    if (!expense) throw new BadRequestException('Gasto no encontrado')
    return this.settle({
      amount,
      date,
      bankAccountId,
      direction: 'OUT',
      total: asNumber(expense.total),
      paid: asNumber(expense.paidAmount),
      link: { expenseId: id },
      apply: (tx, paidAmount, status) =>
        tx.expense.update({
          where: { id },
          data: { paidAmount, status: status === 'PAGADA' ? 'PAGADA' : 'REGISTRADA' },
        }),
    })
  }

  private async settle(input: {
    amount: number
    date: string
    bankAccountId?: string
    direction: PayDirection
    total: number
    paid: number
    link: { issuedInvoiceId?: string; receivedInvoiceId?: string; expenseId?: string }
    apply: (tx: Prisma.TransactionClient, paidAmount: number, status: 'PAGADA' | 'PARCIAL') => Promise<unknown>
  }) {
    const amount = money(input.amount)
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('El importe tiene que ser mayor que cero')
    if (amount > MAX_MONEY) throw new BadRequestException(`El importe no puede superar ${euroLimit()}`)
    const remaining = money(input.total - input.paid)
    if (cents(amount) > cents(remaining)) {
      throw new BadRequestException('El importe supera lo pendiente')
    }
    if (input.bankAccountId) {
      const account = await this.prisma.bankAccount.findUnique({ where: { id: input.bankAccountId } })
      if (!account) throw new BadRequestException('Cuenta bancaria no encontrada')
    }
    const paidAmount = money(input.paid + amount)
    const status = cents(paidAmount) >= cents(input.total) ? 'PAGADA' : 'PARCIAL'
    return this.prisma.$transaction(async (tx) => {
      let bankMovementId: string | undefined
      if (input.bankAccountId) {
        const movement = await tx.bankMovement.create({
          data: {
            accountId: input.bankAccountId,
            date: utcDay(input.date),
            concept: input.direction === 'IN' ? 'Cobro' : 'Pago',
            amount: input.direction === 'IN' ? amount : -amount,
          },
        })
        bankMovementId = movement.id
      }
      await tx.payment.create({
        data: {
          direction: input.direction,
          amount,
          date: utcDay(input.date),
          bankMovementId,
          ...input.link,
        },
      })
      await input.apply(tx, paidAmount, status)
      return { paidAmount, remaining: money(input.total - paidAmount), status }
    })
  }
}
