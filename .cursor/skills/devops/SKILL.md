---
name: devops
description: Prepara el monorepo, Postgres, Docker y el despliegue de Norte Luz en Neon, Railway y Vercel. Usar al cambiar scripts, variables de entorno, Dockerfile, compose o el README.
---

# DevOps

pnpm workspaces. `packages/tax` se compila a `dist` antes que la API. La web no depende del paquete fiscal.

## Local

`docker compose up -d` levanta Postgres 16 en el puerto local 5433. `DATABASE_URL` apunta a ese servicio. `pnpm db:setup` aplica el esquema y el seed. La web usa el puerto 3000. La API usa `PORT` (3002 en el ejemplo local, porque 3001 puede estar ocupado).

## Producción

- Neon: Postgres. La API usa la URL pooled (`-pooler` en el host), no el driver serverless, porque NestJS es un proceso largo en Railway.
- Railway: Dockerfile de la raíz. Al arrancar, `prisma db push` y seed solo si no hay usuarios. `SEED_FORCE` no se activa en producción.
- Vercel: directorio raíz `apps/web`. `NEXT_PUBLIC_API_URL` es la URL pública de Railway.
- `CORS_ORIGIN` es el dominio de Vercel.
- Salud: `GET /health`.
- Reseed manual: `pnpm db:seed -- --force`.

`.env` no se versiona. Sí `.env.example` en la raíz, en `apps/api` y en `apps/web`.
