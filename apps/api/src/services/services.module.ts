import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common'
import { IsIn, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator'
import { LIMIT, MAX_MONEY } from '../common/check'
import { asNumber, money } from '../common/money'
import { PrismaService } from '../prisma/prisma.service'
import { Require } from '../auth/decorators'

class ServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(LIMIT.name, { message: 'El nombre admite hasta 120 caracteres' })
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(LIMIT.description, { message: 'La descripción admite hasta 500 caracteres' })
  description?: string

  @IsNumber()
  @Min(0)
  @Max(MAX_MONEY)
  unitPrice!: number

  @IsIn([0, 4, 10, 21])
  vatRate!: number
}

@Controller('services')
export class ServicesController {
  constructor(private prisma: PrismaService) {}

  @Require('services')
  @Get()
  async list() {
    const rows = await this.prisma.serviceItem.findMany({ orderBy: { name: 'asc' } })
    return rows.map((row) => ({ ...row, unitPrice: asNumber(row.unitPrice) }))
  }

  @Require('services')
  @Post()
  async create(@Body() body: ServiceDto) {
    const row = await this.prisma.serviceItem.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        unitPrice: money(body.unitPrice),
        vatRate: body.vatRate,
      },
    })
    return { ...row, unitPrice: asNumber(row.unitPrice) }
  }

  @Require('services')
  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: ServiceDto) {
    await this.ensure(id)
    const row = await this.prisma.serviceItem.update({
      where: { id },
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        unitPrice: money(body.unitPrice),
        vatRate: body.vatRate,
      },
    })
    return { ...row, unitPrice: asNumber(row.unitPrice) }
  }

  @Require('services', 'delete')
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.ensure(id)
    await this.prisma.serviceItem.delete({ where: { id } })
    return { ok: true }
  }

  private async ensure(id: string) {
    const row = await this.prisma.serviceItem.findUnique({ where: { id } })
    if (!row) throw new NotFoundException('Servicio no encontrado')
  }
}
