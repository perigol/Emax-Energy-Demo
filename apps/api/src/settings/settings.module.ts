import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'
import { LIMIT, taxId } from '../common/check'
import type { Response } from 'express'
import { PrismaService } from '../prisma/prisma.service'
import { Require } from '../auth/decorators'

class SettingsDto {
  @IsString()
  @MinLength(2)
  @MaxLength(LIMIT.legalName, { message: 'La razón social admite hasta 160 caracteres' })
  legalName!: string

  @IsString()
  @MinLength(3)
  @MaxLength(LIMIT.nif)
  nif!: string

  @IsString()
  @MinLength(4)
  @MaxLength(LIMIT.address, { message: 'El domicilio admite hasta 200 caracteres' })
  fiscalAddress!: string

  @IsOptional()
  @IsString()
  invoiceSeries?: string

  @IsOptional()
  @IsBoolean()
  roiRegistered?: boolean
}

@Controller('settings')
export class SettingsController {
  constructor(private prisma: PrismaService) {}

  @Require('settings')
  @Get()
  async get() {
    const org = await this.org()
    return {
      id: org.id,
      legalName: org.legalName,
      nif: org.nif,
      fiscalAddress: org.fiscalAddress,
      vatRegime: org.vatRegime,
      roiRegistered: org.roiRegistered,
      invoiceSeries: org.invoiceSeries,
      nextNumber: org.nextNumber,
      hasLogo: Boolean(org.logoData),
    }
  }

  @Require('settings')
  @Patch()
  async update(@Body() body: SettingsDto) {
    const org = await this.org()
    const series = (body.invoiceSeries || org.invoiceSeries).trim().toUpperCase()
    if (!/^[A-Z0-9]{1,8}$/.test(series)) {
      throw new BadRequestException('La serie solo admite letras y números, hasta 8 caracteres')
    }
    return this.prisma.organization.update({
      where: { id: org.id },
      data: {
        legalName: body.legalName.trim(),
        nif: taxId(body.nif),
        fiscalAddress: body.fiscalAddress.trim(),
        invoiceSeries: series,
        roiRegistered: Boolean(body.roiRegistered),
      },
      select: {
        legalName: true,
        nif: true,
        fiscalAddress: true,
        vatRegime: true,
        roiRegistered: true,
        invoiceSeries: true,
        nextNumber: true,
      },
    })
  }

  @Require('settings')
  @Post('logo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1024 * 1024 } }))
  async logo(
    @UploadedFile() file?: { size: number; mimetype: string; buffer: Buffer },
  ) {
    if (!file) throw new BadRequestException('Falta el logo')
    if (!['image/png', 'image/jpeg'].includes(file.mimetype)) {
      throw new BadRequestException('El logo tiene que ser PNG o JPG')
    }
    const org = await this.org()
    await this.prisma.organization.update({
      where: { id: org.id },
      data: { logoData: new Uint8Array(file.buffer) as Uint8Array<ArrayBuffer>, logoMime: file.mimetype },
    })
    return { ok: true }
  }

  @Require('settings')
  @Get('logo')
  async logoFile(@Res() response: Response) {
    const org = await this.org()
    if (!org.logoData || !org.logoMime) throw new NotFoundException('No hay logo')
    response.setHeader('Content-Type', org.logoMime)
    response.send(Buffer.from(org.logoData))
  }

  private async org() {
    const org = await this.prisma.organization.findFirst()
    if (!org) throw new NotFoundException('La empresa todavía no está configurada')
    return org
  }
}
