# Agentes de EnerFactura

Muestra de contabilidad española. Cada skill vive en `.cursor/skills/` y se aplica al trabajar en su zona. El cálculo fiscal no se reescribe en la API ni en la web.

| Skill | Carpeta | La convoca |
| --- | --- | --- |
| fiscal | `packages/tax` | Cualquier cambio de modelos 303, 111 o 349 |
| backend | `apps/api` | Endpoints, Prisma, seed, PDF |
| frontend | `apps/web` | Pantallas y cliente HTTP |
| ui | `apps/web` y el PDF | Layout, copia en español, factura impresa |
| seguridad | `apps/api/src/auth` y adjuntos | Roles, JWT, archivos, demo pública |
| devops | raíz, Docker, README | Entornos, Neon, Railway, Vercel |

Orden de un cambio que cruce capas: fiscal (tests) → backend (mapper) → frontend (pantalla) → seguridad si toca permisos → devops si toca el despliegue.

La prueba de cierre del T1 2026 es devengado 252, deducible 126, a ingresar 126. Si el panel no coincide con `packages/tax`, el cambio no está listo.
