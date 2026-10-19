# EnerFactura

Muestra de contabilidad y facturación española para una pyme de servicios energéticos. Next.js muestra los datos. NestJS y Postgres los guardan. Los modelos 303, 111 y 349 se calculan en `packages/tax` a partir de las facturas, no de cifras fijas en la pantalla.

Es un cálculo de demostración del régimen general trimestral. No presenta modelos en la Agencia Tributaria ni genera una factura con valor legal.

## Probarlo en local

Hace falta Node 20 o superior, pnpm y Docker.

```bash
docker compose up -d
pnpm install
pnpm db:setup
pnpm --filter @norteluz/api dev
pnpm --filter @norteluz/web dev
```

La web queda en `http://localhost:3000` y la API en `http://localhost:3002`. Postgres usa el puerto 5433.

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | admin@norteluz.es | demo1234 |
| Gestor | gestor@norteluz.es | demo1234 |
| Carga de facturas | facturas@norteluz.es | demo1234 |

En el 1T 2026 el 303 tiene que mostrar devengado 252, deducible 126 y 126 a ingresar. El 111 tiene un perceptor, base 400 y retención 60. El 349 tiene una entrega de servicios a Francia (clave S, 500) y una adquisición de bienes a Alemania (clave A, 200).

Si se emite una factura nacional de 100 € más 21 de IVA dentro del primer trimestre, el devengado pasa a 273. Para volver al seed:

```bash
pnpm db:seed -- --force
```

`pnpm test` ejecuta el motor fiscal y la matriz de roles. `pnpm verify` repite el recorrido contra la API en marcha y restaura el seed al terminar.

## Cómo está partido

| Carpeta | Responsabilidad |
| --- | --- |
| `packages/tax` | 303, 111 y 349. Tests del T1 2026 |
| `apps/api` | NestJS, Prisma, PDF, permisos |
| `apps/web` | Next.js. No recalcula impuestos |
| `.cursor/skills` | Instrucciones de los agentes que mantienen cada zona |
| `AGENTS.md` | Qué agente toca qué carpeta |

El rol Facturas solo puede registrar facturas recibidas y gastos. Impuestos, emitidas, bancos y configuración responden 403. Un borrador no entra en el trimestre. Una rectificativa resta.

## Publicar la demo

Tres servicios, la misma base:

1. **Neon.** Crea un proyecto Postgres y copia la cadena *pooled* (el host lleva `-pooler`).
2. **Railway.** Nuevo servicio desde este repositorio, con el Dockerfile de la raíz. Variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (la URL de Vercel) y `PORT`. Al arrancar hace `prisma db push` y carga el seed si no hay usuarios. La salud es `GET /health`.
3. **Vercel.** Importa el repositorio con directorio raíz `apps/web`. Variable `NEXT_PUBLIC_API_URL` con la URL pública de Railway.

`POST /internal/reseed` solo existe si defines `RESEED_TOKEN`. La cabecera es `x-reseed-token`. Sin esa variable la ruta responde 404.

Los datos de la demo se pueden modificar porque el enlace es público. El aviso en pantalla lo dice, y el seed los deja como al principio.
