---
name: frontend
description: Construye las pantallas Next.js que consumen la API de Norte Luz. Usar al modificar apps/web, el panel, facturas, impuestos, sesión o el cliente HTTP.
---

# Frontend

App Router en `apps/web`. El navegador llama a NestJS con `NEXT_PUBLIC_API_URL` y un JWT en `localStorage`.

No calcules el 303, el 111 ni el 349 en el cliente. Los números del panel salen de `GET /tax/summary`.

## Pantallas

`/login`, `/panel`, `/contactos`, `/contactos/[id]`, `/facturas`, `/facturas/nueva`, `/facturas/[id]`, `/recibidas`, `/recibidas/nueva`, `/gastos`, `/bancos`, `/impuestos`, `/configuracion`, `/usuarios`, `/actividad`.

## Roles en la interfaz

Ocultar un enlace no sustituye al 403 de la API. Aun así, el rol Facturas solo ve recibidas y gastos. Gestor no ve configuración ni usuarios. Administrador ve todo.

## Formato

Importes con `es-ES` y EUR. Fechas `dd/mm/aaaa`. Trimestres rotulados `1T 2026`. Errores de la API se muestran en español, incluido el 403.
