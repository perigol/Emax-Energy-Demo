---
name: fiscal
description: Calcula los modelos españoles 303, 111 y 349 a partir de documentos de facturación. Usar al modificar packages/tax, el seed del T1, trimestres, IVA, IRPF o el panel de impuestos.
---

# Fiscal

El cálculo vive solo en `packages/tax`. NestJS mapea filas a `TaxDocument` y llama a `calculatePeriod`. La web muestra la respuesta.

## Documentos que entran

- Emitidas en estado EMITIDA, COBRADA_PARCIAL o COBRADA.
- Recibidas y gastos en estado REGISTRADA o PAGADA.
- Un BORRADOR no entra.
- Una rectificativa resta: el motor aplica signo negativo una sola vez.

El trimestre sale de la fecha UTC del documento. Enero–marzo es T1, abril–junio T2, julio–septiembre T3, octubre–diciembre T4.

## Reglas

- Nacional emitida: el IVA suma al devengado del 303, desglosado por tipo 0, 4, 10 y 21.
- Nacional recibida o gasto con IVA deducible: suma al deducible. Si no es deducible, queda fuera del 303.
- Intracomunitaria de bienes recibida: clave A del 349. El IVA se autorrepercute (devengado y, si es deducible, deducible).
- Intracomunitaria de servicios recibida: clave I. Mismo trato de IVA.
- Intracomunitaria de bienes emitida: clave E, IVA 0, la base va a entregas intracomunitarias.
- Intracomunitaria de servicios emitida: clave S, IVA 0, la base va a entregas intracomunitarias.
- Inversión del sujeto pasivo en una recibida: autorrepercusión en el 303 y no entra en el 349.
- El 111 solo mira IRPF de recibidas y gastos con retención mayor que cero. Cuenta perceptores distintos. El IRPF de una emitida no entra en el 111.
- El 349 agrupa por NIF-IVA y clave, y suma la base. Sin NIF-IVA no hay línea.

## Prueba del T1 2026

Estos cinco documentos son el seed y los tests. El 303 tiene que dar devengado 252, deducible 126 y a ingresar 126.

- Emitida nacional: base 1000, IVA 210.
- Servicio a empresa francesa: base 500, IVA 0, clave S.
- Recibida de profesional: base 400, IVA 84 deducible, IRPF 60. Un perceptor en el 111.
- Bienes de empresa alemana: base 200, clave A. IVA devengado 42 y deducible 42.
- Comida no deducible: base 50, IVA al 10 %. Fuera del 303.

El formulario completo de la Agencia Tributaria no se genera. El resultado es un cálculo de demostración del régimen general trimestral.
