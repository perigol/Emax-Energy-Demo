import { Prisma, PrismaClient, type OperationType } from '@prisma/client'
import { demoT1Documents } from '@norteluz/tax'
import bcrypt from 'bcryptjs'

const DEMO_PASSWORD = 'demo1234'

function day(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`)
}

function fixture(id: string) {
  const doc = demoT1Documents().find((item) => item.id === id)
  if (!doc) throw new Error(`Falta el documento de demo ${id}`)
  return doc
}

async function wipe(prisma: PrismaClient) {
  await prisma.activityLog.deleteMany()
  await prisma.quarterSettlement.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.bankMovement.deleteMany()
  await prisma.bankAccount.deleteMany()
  await prisma.issuedInvoiceLine.deleteMany()
  await prisma.issuedInvoice.deleteMany({ where: { rectifiesId: { not: null } } })
  await prisma.issuedInvoice.deleteMany()
  await prisma.receivedInvoice.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.serviceItem.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.user.deleteMany()
  await prisma.organization.deleteMany()
}

export async function runSeed(options?: { force?: boolean; prisma?: PrismaClient }) {
  const prisma = options?.prisma ?? new PrismaClient()
  const ownsClient = !options?.prisma
  try {
    const existing = await prisma.user.count()
    if (existing > 0 && !options?.force) return { seeded: false }
    if (options?.force) await wipe(prisma)

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
    await prisma.organization.create({
      data: {
        legalName: 'Norte Luz Servicios Energéticos S.L.',
        nif: 'B66521089',
        fiscalAddress: 'Carrer de Provença 312, 08037 Barcelona',
        vatRegime: 'GENERAL',
        roiRegistered: true,
        invoiceSeries: 'NL',
        nextNumber: 5,
      },
    })

    await prisma.user.createMany({
      data: [
        { email: 'admin@norteluz.es', name: 'Ana Rivas', role: 'ADMIN', passwordHash },
        { email: 'gestor@norteluz.es', name: 'Luis Ortega', role: 'GESTOR', passwordHash },
        { email: 'facturas@norteluz.es', name: 'Nora Campos', role: 'FACTURAS', passwordHash },
      ],
    })

    const taller = await prisma.contact.create({
      data: {
        name: 'Taller Sol S.L.',
        nif: 'B11223344',
        country: 'ES',
        kind: 'CLIENT',
        email: 'contabilidad@tallersol.es',
        address: 'Carrer de la Llum 8, 08001 Barcelona',
      },
    })
    const franciaDoc = fixture('emitida-francia')
    const francia = await prisma.contact.create({
      data: {
        name: franciaDoc.counterpartyName || 'Atelier Lumière SARL',
        nif: 'FR40303265045',
        vatNumber: franciaDoc.counterpartyVatId,
        country: 'FR',
        kind: 'CLIENT',
        address: '12 rue des Ateliers, 69002 Lyon',
      },
    })
    const profesionalDoc = fixture('recibida-profesional')
    const marta = await prisma.contact.create({
      data: {
        name: profesionalDoc.counterpartyName || 'Marta Ruiz Estudio',
        nif: '45678123P',
        country: 'ES',
        kind: 'SUPPLIER',
        isProfessional: true,
        defaultIrpfRate: new Prisma.Decimal(15),
        email: 'marta@ruizestudio.es',
      },
    })
    const alemaniaDoc = fixture('recibida-alemania')
    const kraft = await prisma.contact.create({
      data: {
        name: alemaniaDoc.counterpartyName || 'Kraft Teile GmbH',
        nif: 'DE811569869',
        vatNumber: alemaniaDoc.counterpartyVatId,
        country: 'DE',
        kind: 'SUPPLIER',
        address: 'Hafenstraße 4, 20457 Hamburg',
      },
    })
    const papel = await prisma.contact.create({
      data: {
        name: 'Papel y Tinta S.L.',
        nif: 'B99887762',
        country: 'ES',
        kind: 'SUPPLIER',
      },
    })

    await prisma.serviceItem.createMany({
      data: [
        { name: 'Asesoramiento energético', description: 'Revisión de contrato y potencia', unitPrice: 1000, vatRate: 21 },
        { name: 'Informe de consumo', description: 'Análisis del último año', unitPrice: 500, vatRate: 21 },
        { name: 'Cuota de gestión', description: 'Seguimiento trimestral', unitPrice: 200, vatRate: 21 },
      ],
    })

    const nacional = fixture('emitida-nacional')
    const issuedNational = await prisma.issuedInvoice.create({
      data: {
        series: 'NL',
        number: 1,
        contactId: taller.id,
        issueDate: day(nacional.date),
        dueDate: day('2026-03-12'),
        status: 'COBRADA',
        operation: nacional.operation as OperationType,
        base: nacional.base,
        vat: nacional.vatAmount,
        total: nacional.base + nacional.vatAmount,
        paidAmount: nacional.base + nacional.vatAmount,
        lines: {
          create: {
            concept: 'Asesoramiento energético',
            quantity: 1,
            unitPrice: nacional.base,
            vatRate: 21,
            base: nacional.base,
            vatAmount: nacional.vatAmount,
          },
        },
      },
    })

    const issuedFrance = await prisma.issuedInvoice.create({
      data: {
        series: 'NL',
        number: 2,
        contactId: francia.id,
        issueDate: day(franciaDoc.date),
        dueDate: day('2026-03-20'),
        status: 'COBRADA',
        operation: franciaDoc.operation as OperationType,
        base: franciaDoc.base,
        vat: 0,
        total: franciaDoc.base,
        paidAmount: franciaDoc.base,
        lines: {
          create: {
            concept: 'Informe de consumo',
            quantity: 1,
            unitPrice: franciaDoc.base,
            vatRate: 0,
            base: franciaDoc.base,
            vatAmount: 0,
          },
        },
      },
    })

    await prisma.issuedInvoice.create({
      data: {
        series: 'NL',
        number: 3,
        contactId: taller.id,
        issueDate: day('2026-05-10'),
        dueDate: day('2026-06-10'),
        status: 'EMITIDA',
        operation: 'NACIONAL',
        base: 800,
        vat: 168,
        total: 968,
        paidAmount: 0,
        lines: {
          create: {
            concept: 'Cuota de gestión, segundo trimestre',
            quantity: 4,
            unitPrice: 200,
            vatRate: 21,
            base: 800,
            vatAmount: 168,
          },
        },
      },
    })

    await prisma.issuedInvoice.create({
      data: {
        series: 'NL',
        number: 4,
        contactId: taller.id,
        issueDate: day('2026-08-01'),
        dueDate: day('2026-08-31'),
        status: 'COBRADA',
        operation: 'NACIONAL',
        base: 200,
        vat: 42,
        total: 242,
        paidAmount: 242,
        lines: {
          create: {
            concept: 'Cuota de gestión',
            quantity: 1,
            unitPrice: 200,
            vatRate: 21,
            base: 200,
            vatAmount: 42,
          },
        },
      },
    })

    const receivedPro = await prisma.receivedInvoice.create({
      data: {
        supplierId: marta.id,
        number: 'MR-77',
        date: day(profesionalDoc.date),
        operation: profesionalDoc.operation as OperationType,
        concept: 'Diseño del informe para clientes',
        base: profesionalDoc.base,
        vatRate: 21,
        vat: profesionalDoc.vatAmount,
        vatDeductible: true,
        irpfWithheld: profesionalDoc.irpfAmount,
        total: 424,
        paidAmount: 424,
        status: 'PAGADA',
      },
    })

    const receivedDe = await prisma.receivedInvoice.create({
      data: {
        supplierId: kraft.id,
        number: 'DE-88421',
        date: day(alemaniaDoc.date),
        operation: alemaniaDoc.operation as OperationType,
        concept: 'Material de medición',
        base: alemaniaDoc.base,
        vatRate: 21,
        vat: alemaniaDoc.vatAmount,
        vatDeductible: true,
        irpfWithheld: 0,
        total: alemaniaDoc.base,
        paidAmount: alemaniaDoc.base,
        status: 'PAGADA',
      },
    })

    await prisma.receivedInvoice.create({
      data: {
        supplierId: papel.id,
        number: 'PT-110',
        date: day('2026-11-03'),
        operation: 'NACIONAL',
        concept: 'Material de oficina',
        base: 100,
        vatRate: 21,
        vat: 21,
        vatDeductible: true,
        total: 121,
        paidAmount: 0,
        status: 'REGISTRADA',
      },
    })

    const comida = fixture('gasto-comida')
    const expense = await prisma.expense.create({
      data: {
        supplierName: comida.counterpartyName || 'Casa Brava',
        category: 'Restauración',
        number: 'TK-318',
        date: day(comida.date),
        operation: 'NACIONAL',
        concept: 'Comida con un cliente',
        base: comida.base,
        vatRate: comida.vatRate,
        vat: comida.vatAmount,
        vatDeductible: false,
        total: comida.base + comida.vatAmount,
        paidAmount: comida.base + comida.vatAmount,
        status: 'PAGADA',
      },
    })

    const account = await prisma.bankAccount.create({
      data: { name: 'Cuenta corriente', iban: 'ES7921000813610123456789' },
    })
    const cobro = await prisma.bankMovement.create({
      data: { accountId: account.id, date: day('2026-02-18'), concept: 'Cobro Taller Sol', amount: 1210 },
    })
    const pago = await prisma.bankMovement.create({
      data: { accountId: account.id, date: day('2026-01-30'), concept: 'Pago Marta Ruiz', amount: -424 },
    })
    await prisma.bankMovement.create({
      data: {
        accountId: account.id,
        date: day('2026-03-06'),
        concept: 'Comisión de mantenimiento',
        amount: -30,
      },
    })

    await prisma.payment.create({
      data: {
        direction: 'IN',
        amount: 1210,
        date: day('2026-02-18'),
        issuedInvoiceId: issuedNational.id,
        bankMovementId: cobro.id,
      },
    })
    await prisma.payment.create({
      data: {
        direction: 'IN',
        amount: franciaDoc.base,
        date: day('2026-02-28'),
        issuedInvoiceId: issuedFrance.id,
      },
    })
    await prisma.payment.create({
      data: {
        direction: 'OUT',
        amount: 424,
        date: day('2026-01-30'),
        receivedInvoiceId: receivedPro.id,
        bankMovementId: pago.id,
      },
    })
    await prisma.payment.create({
      data: {
        direction: 'OUT',
        amount: alemaniaDoc.base,
        date: day('2026-03-10'),
        receivedInvoiceId: receivedDe.id,
      },
    })
    await prisma.payment.create({
      data: {
        direction: 'OUT',
        amount: comida.base + comida.vatAmount,
        date: day(comida.date),
        expenseId: expense.id,
      },
    })
    await prisma.payment.create({
      data: {
        direction: 'IN',
        amount: 242,
        date: day('2026-08-20'),
        issuedInvoiceId: (
          await prisma.issuedInvoice.findFirstOrThrow({ where: { number: 4 } })
        ).id,
      },
    })

    return { seeded: true }
  } finally {
    if (ownsClient) await prisma.$disconnect()
  }
}
