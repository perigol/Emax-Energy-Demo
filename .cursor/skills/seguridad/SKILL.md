---
name: seguridad
description: Exige autenticación, roles y límites de la demo pública de EnerFactura. Usar al tocar login, guards, usuarios, adjuntos, CORS o el seed.
---

# Seguridad

El permiso se decide en la API. La matriz vive en `apps/api/src/auth/permissions.ts` y tiene tests.

| Acción | ADMIN | GESTOR | FACTURAS |
| --- | --- | --- | --- |
| Configuración, usuarios y bitácora | sí | no | no |
| Emitidas, contactos, bancos, impuestos, servicios | sí | sí | no |
| Alta y lectura de recibidas y gastos | sí | sí | sí |
| Borrar documentos | sí | sí | no |

- Contraseñas con bcrypt. Un alta o un cambio exige 8 caracteres, mayúscula, minúscula, número y símbolo. El login de la demo sigue aceptando `demo1234`. El JWT dura 12 horas y usa `JWT_SECRET`.
- Adjuntos en memoria y luego en Postgres, máximo 2 MB, solo PDF o imagen.
- `POST /internal/reseed` exige `RESEED_TOKEN`. Si la variable no está, la ruta responde 404.
- CORS solo acepta `CORS_ORIGIN`.
- Los usuarios de demo y sus claves van en el README. No hay otro secreto en el repositorio.
- El seed usa NIF y NIF-IVA de ficción.
