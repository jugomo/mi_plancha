# algorithm-spec

Casos de prueba compartidos para el **algoritmo de sugerencia de cocción** ([`../ALGORITHM.md`](../ALGORITHM.md)). Cada archivo en `cases/` es una entrada-salida completa e independiente: un estado de la plancha/pedidos como `input`, y la sugerencia que ese estado **debe** producir como `output`.

El objetivo es que las tres implementaciones (Angular, SwiftUI, Jetpack Compose — ver [`../ARCHITECTURE.md`](../ARCHITECTURE.md)) carguen estos mismos ficheros en su framework de test respectivo y verifiquen que su propio código produce el `output` esperado a partir del `input`. Al no haber backend que centralice el algoritmo, este es el mecanismo que evita que las tres versiones diverjan silenciosamente.

## Formato de un caso

```jsonc
{
  "id": "string — identifica el caso, coincide con el nombre de archivo",
  "descripcion": "string — qué comportamiento verifica este caso",
  "input": {
    "ahora": "ISO 8601 — instante en el que se evalúa la sugerencia",
    "planchaCapacidadTotal": "number",
    "overflowPorcentaje": "number — ej. 10 significa +10%",
    "overflowManualActivo": "boolean",
    "capacidadUsadaActual": "number — suma ya ocupada en la plancha antes de aplicar la sugerencia",
    "tiempoMaximoEsperaMin": "number — anti-inanición",
    "division": { "umbral": "number", "tamanoSubgrupo": "number" },
    "ingredientes": {
      "<id>": { "capacidadUnidad": "number", "tiempoCoccionSeg": "number" }
    },
    "pedidos": [
      {
        "id": "string",
        "creadoEn": "ISO 8601",
        "subgrupoActual": "number (opcional, por defecto 1)",
        "lineas": [
          { "id": "string", "ingrediente": "<id>", "cantidad": "number", "estado": "pendiente", "subgrupo": "number (opcional, por defecto 1)" }
        ]
      }
    ]
  },
  "output": {
    "sugerencia": [
      { "pedidoId": "string", "lineaId": "string", "ingrediente": "<id>", "cantidad": "number", "usandoOverflow": "boolean" }
    ],
    "capacidadUsadaResultante": "number",
    "alertas": ["string — id del pedido forzado que no cabe (la capa de presentación compone el mensaje legible, con mesa/cliente), vacío si no hay"]
  }
}
```

Notas para quien implemente el test en cada plataforma:

- `sugerencia` se compara **como conjunto** (el orden no importa), por contenido de cada entrada.
- Cualquier línea `pendiente` del `input` que **no** aparezca en `sugerencia` debe seguir en `pendiente` — es decir, el test también sirve para comprobar qué se excluye, no solo qué se incluye.
- Los casos están pensados para ejecutarse de forma aislada (no dependen unos de otros).

## Casos incluidos

| Archivo | Verifica |
|---|---|
| `01-adelantamiento-basico.json` | Cola FIFO con forzado por anti-inanición; un pedido grande que no cabe no bloquea a los siguientes más pequeños (Paso 3 de `ALGORITHM.md`). |
| `02-overflow-automatico.json` | Overflow automático solo para el pedido forzado que no cabe ni así; no se comparte con pedidos no forzados aunque quede hueco extendido. |
| `03-overflow-manual.json` | Overflow manual activo extiende el techo de capacidad para toda la cola, no solo para forzados. |
| `04-division-pedido-grande.json` | Solo las líneas del subgrupo actual de un pedido dividido son candidatas; el resto del pedido no entra aunque cupiera. |
