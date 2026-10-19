---
name: backend
description: Implementa la API NestJS, Prisma y el seed de EnerFactura. Usar al modificar apps/api, endpoints, DTOs, facturas, bancos o el mapeo hacia packages/tax.
---

# Backend

API en `apps/api`. TypeScript strict. La fuente de verdad del IVA es `@norteluz/tax`. Este paquete no vuelve a calcular tipos ni trimestres.

## Módulos

`auth`, `contacts`, `services`, `issued-invoices`, `received-invoices`, `expenses`, `payments`, `banks`, `tax`, `settings`, `users`, `audit`.

Al guardar un contacto con NIF-IVA, la API consulta VIES. Si el número no está dado de alta, no se guarda. Si VIES no responde, el contacto se guarda y la respuesta lo indica. El cálculo fiscal no depende de esa consulta.

Prisma usa Postgres. Importes `Decimal(12,2)`. Fechas `@db.Date` y se serializan a UTC para el motor fiscal.

## Facturas emitidas

- El número `serie-año-0001` se asigna dentro de una transacción al pasar a EMITIDA, incrementando `Organization.nextNumber`.
- Un borrador no tiene número definitivo.
- La rectificativa guarda importes en valor absoluto, `rectifiesId` y el motor fiscal resta.
- El PDF sale de la API con los datos ya guardados.

## Mapeo fiscal

Cada emitida, recibida y gasto contabilizable se convierte en `TaxDocument`. Los borradores no se envían. `GET /tax/summary`, `/tax/303`, `/tax/111` y `/tax/349` leen el mismo mapper.

## Seed

`prisma/seed.ts` carga EnerFactura, los tres usuarios y el T1 2026 definido en la skill fiscal, más documentos cortos en T2, T3 y T4. Si ya hay usuarios, no pisa los datos, salvo `pnpm db:seed -- --force` o `SEED_FORCE=true`.
