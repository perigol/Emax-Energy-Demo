import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common'
import { ContactKind, Prisma } from '@prisma/client'
import { IsBoolean, IsEmail, IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'
import { LIMIT, taxId } from '../common/check'
import { requireVies, ViesCheck } from './vies'
import { asNumber } from '../common/money'
import { PrismaService } from '../prisma/prisma.service'
import { Require } from '../auth/decorators'

class ContactDto {
  @IsString()
  @MinLength(2, { message: 'El nombre es demasiado corto' })
  @MaxLength(LIMIT.name, { message: 'El nombre admite hasta 120 caracteres' })
  name!: string

  @IsString()
  @MinLength(3, { message: 'El NIF es demasiado corto' })
  @MaxLength(LIMIT.nif, { message: 'El NIF admite hasta 20 caracteres' })
  nif!: string

  @IsIn(['CLIENT', 'SUPPLIER', 'BOTH'])
  kind!: ContactKind

  @IsOptional()
  @IsString()
  @MaxLength(2, { message: 'El país se indica con dos letras, por ejemplo ES' })
  country?: string

  @IsOptional()
  @IsString()
  @MaxLength(LIMIT.nif)
  vatNumber?: string

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  @MaxLength(LIMIT.email)
  email?: string

  @IsOptional()
  @IsString()
  @MaxLength(LIMIT.address, { message: 'La dirección admite hasta 200 caracteres' })
  address?: string

  @IsOptional()
  @IsBoolean()
  isProfessional?: boolean

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  defaultIrpfRate?: number
}

function present(contact: {
  defaultIrpfRate: Prisma.Decimal | null
  [key: string]: unknown
}) {
  return { ...contact, defaultIrpfRate: contact.defaultIrpfRate ? asNumber(contact.defaultIrpfRate) : null }
}

@Controller('contacts')
export class ContactsController {
  constructor(private prisma: PrismaService) {}

  @Require('contacts')
  @Get()
  async list() {
    const rows = await this.prisma.contact.findMany({ orderBy: { name: 'asc' } })
    return rows.map(present)
  }

  @Require('contacts')
  @Get(':id')
  async one(@Param('id') id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } })
    if (!contact) throw new NotFoundException('Contacto no encontrado')
    const [issued, received] = await Promise.all([
      this.prisma.issuedInvoice.findMany({
        where: { contactId: id },
        orderBy: { issueDate: 'desc' },
        select: { id: true, series: true, number: true, issueDate: true, status: true, total: true, operation: true },
      }),
      this.prisma.receivedInvoice.findMany({
        where: { supplierId: id },
        orderBy: { date: 'desc' },
        select: { id: true, number: true, date: true, status: true, total: true, operation: true },
      }),
    ])
    return {
      ...present(contact),
      issued: issued.map((row) => ({ ...row, total: asNumber(row.total), issueDate: row.issueDate.toISOString().slice(0, 10) })),
      received: received.map((row) => ({ ...row, total: asNumber(row.total), date: row.date.toISOString().slice(0, 10) })),
    }
  }

  @Require('contacts')
  @Post()
  async create(@Body() body: ContactDto) {
    const data = this.toData(body)
    const vies = await this.guard(data.vatNumber)
    const created = await this.prisma.contact.create({ data })
    return { ...present(created), vies }
  }

  @Require('contacts')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: ContactDto) {
    await this.ensure(id)
    const data = this.toData(body)
    const vies = await this.guard(data.vatNumber)
    const updated = await this.prisma.contact.update({ where: { id }, data })
    return { ...present(updated), vies }
  }

  @Require('contacts', 'delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.ensure(id)
    const [issued, received] = await Promise.all([
      this.prisma.issuedInvoice.count({ where: { contactId: id } }),
      this.prisma.receivedInvoice.count({ where: { supplierId: id } }),
    ])
    if (issued + received > 0) {
      throw new BadRequestException('Este contacto tiene facturas y no se puede borrar')
    }
    await this.prisma.contact.delete({ where: { id } })
    return { ok: true }
  }

  private async guard(vatNumber: string | null | undefined): Promise<ViesCheck | null> {
    if (!vatNumber) return null
    return requireVies(vatNumber)
  }

  private async ensure(id: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id } })
    if (!contact) throw new NotFoundException('Contacto no encontrado')
    return contact
  }

  private toData(body: ContactDto): Prisma.ContactCreateInput {
    const country = (body.country || 'ES').trim().toUpperCase()
    if (!/^[A-Z]{2}$/.test(country)) {
      throw new BadRequestException('El país se indica con dos letras, por ejemplo ES')
    }
    const rate = body.defaultIrpfRate ?? 15
    if (body.isProfessional && (rate < 0 || rate > 100)) {
      throw new BadRequestException('La retención tiene que estar entre 0 y 100')
    }
    return {
      name: body.name.trim(),
      nif: taxId(body.nif),
      kind: body.kind,
      country,
      vatNumber: body.vatNumber?.trim() ? taxId(body.vatNumber) : null,
      email: body.email?.trim() || null,
      address: body.address?.trim() || null,
      isProfessional: Boolean(body.isProfessional),
      defaultIrpfRate: body.isProfessional ? rate : null,
    }
  }
}
