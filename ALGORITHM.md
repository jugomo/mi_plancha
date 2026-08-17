# Algoritmo de sugerencia de cocción — mi_plancha

Para el modelo de dominio, ver [DOMAIN.md](./DOMAIN.md). Para dónde y cómo se ejecuta este algoritmo (cliente, sin backend), ver [ARCHITECTURE.md](./ARCHITECTURE.md).

## Objetivo

En cada momento, proponer al cocinero **qué líneas de pedido colocar ahora mismo en la plancha**, maximizando el uso de su capacidad libre, respetando la prioridad por orden de llegada (con flexibilidad para adelantar pedidos que sí quepan) y garantizando que ningún pedido espere más del tiempo máximo configurado (anti-inanición).

Es una **heurística voluntariamente simple** (greedy, no un solver de bin-packing exacto): la sugerencia es siempre orientativa — el cocinero decide y confirma manualmente qué pone en la plancha (ver `DOMAIN.md`) — y una heurística simple es más fácil de razonar, depurar y mantener **idéntica en los tres clientes** (Angular, SwiftUI, Jetpack Compose), ya que no existe backend compartido que centralice el cálculo.

## Entradas

- `capacidad_total` y `capacidad_usada_actual` de la plancha.
- Pedidos con al menos una línea en estado `pendiente`, cada uno con: `timestamp_creación`, líneas (`ingrediente`, `cantidad`, `estado`), cocinero asignado (si lo hay).
- Por ingrediente: `capacidad_unidad`, `tiempo_cocción`.
- Config CMS: `tiempo_máximo_espera` (anti-inanición), `umbral_división` y `tamaño_subgrupo` (división de pedidos), `porcentaje_overflow` (capacidad extra temporal).
- Estado del toggle manual del cocinero: `overflow_activo_manual` (on/off).

## Paso 1 — Urgencia por pedido

```
tiempo_espera(pedido) = ahora - timestamp_creación(pedido)
urgencia(pedido)      = tiempo_espera(pedido) / tiempo_máximo_espera
```

Si `urgencia ≥ 1`, el pedido pasa a estado **forzado**: debe entrar en la próxima sugerencia sí o sí, aunque no sea el encaje más eficiente.

Un pedido dejar de contar para esta métrica en cuanto ya no tiene líneas `pendiente` (todo lo que le queda está en plancha o listo) — ya no está "esperando".

## Paso 2 — Cola de candidatos

Se construye una cola de líneas candidatas a partir de los pedidos con líneas `pendiente`, ordenada:

1. Primero los pedidos **forzados**, de mayor a menor urgencia.
2. Después el resto, por `timestamp_creación` ascendente (FIFO puro).

Para un pedido cuyo nº total de ingredientes supera `umbral_división`, solo se consideran candidatas las líneas de su **subgrupo actual** (de tamaño `tamaño_subgrupo`) — no hace falta que quepa el pedido entero para empezar a avanzar; en cuanto ese subgrupo queda `listo`, el siguiente subgrupo pasa a ser candidato.

## Paso 3 — Selección greedy por capacidad (con overflow)

```
capacidad_extendida = capacidad_total × (1 + porcentaje_overflow)

libre_base       = capacidad_total      - capacidad_usada_actual
libre_extendida  = capacidad_extendida  - capacidad_usada_actual
libre = overflow_activo_manual ? libre_extendida : libre_base

sugerencia = []

para cada pedido en la cola (orden del Paso 2):
  para cada línea pendiente del pedido (agrupada por ingrediente):
    necesaria = cantidad × capacidad_unidad(ingrediente)

    si necesaria ≤ libre:
        sugerencia.añadir(línea)
        libre -= necesaria
    si no cabe, el pedido es forzado, y NO se usó ya overflow manual,
       pero necesaria ≤ libre_extendida - (capacidad_extendida - libre):
        # último recurso automático, solo para pedidos forzados
        sugerencia.añadir(línea, usando_overflow = true)
        libre_extendida -= necesaria
    si tampoco cabe así:
        emitir alerta "pedido #N urgente no cabe en la plancha ni con capacidad extra"
```

El recorrido nunca se detiene en el primer pedido que no cabe: sigue con el siguiente de la cola. Esto es lo que permite adelantar pedidos más pequeños llegados después cuando uno más antiguo y más grande no cabe — sin necesidad de una regla aparte.

El overflow automático **solo se aplica a líneas de pedidos forzados** y únicamente cuando ni siquiera así superan `capacidad_extendida`; para todo lo demás, la capacidad tope sigue siendo `capacidad_total` salvo que el cocinero haya activado el overflow manual, en cuyo caso `libre` parte directamente de `capacidad_extendida` para toda la cola (no solo para los forzados).

## Paso 4 — Bonus de agrupación por tipo de ingrediente

Con la capacidad libre restante tras el Paso 3, se hace una segunda pasada: por cada tipo de ingrediente ya presente en `sugerencia`, buscar más líneas pendientes de ese mismo ingrediente (de cualquier pedido de la cola, aunque sea de menor prioridad) que quepan en lo que queda libre, y añadirlas también.

Motivo: los ingredientes se organizan por tipo sobre la plancha (`DOMAIN.md`) y agrupar refuerzos del mismo tipo aprovecha mejor el hueco sin complicar al cocinero con más tipos simultáneos de los necesarios.

## Paso 5 — Presentación y recálculo

- La sugerencia se muestra como: ingredientes agrupados por tipo + pedidos de origen, capacidad que ocuparía (`usa X/capacidad_total`), y cualquier alerta de pedido forzado que no quepa.
- Si se está usando overflow (manual o automático), se marca visualmente qué líneas lo usan y la barra de capacidad se extiende por encima del 100% hasta `capacidad_extendida`, para que el cocinero sepa en todo momento que está apretando más de lo normal.
- Se **recalcula** ante cualquier cambio relevante: se libera capacidad (ingrediente retirado de la plancha), se crea un pedido nuevo, un cocinero confirma una sugerencia, o pasa el tiempo suficiente como para que la urgencia de algún pedido cruce el umbral forzado (revisión periódica, ej. cada 30 s).

## Qué pedido debe tomar un cocinero libre

Cuando un cocinero queda libre (sin pedido asignado en curso), se le propone tomar el **primer pedido de la cola del Paso 2** que aún no tenga cocinero asignado — mismo criterio de orden (forzados por urgencia, luego FIFO). No hace falta que quepa en la plancha en ese instante: puede tomarlo y esperar a que la sugerencia le indique cuándo colocar sus líneas.

## Ejemplo con datos de referencia

Capacidad total: 100. Capacidades: Hamburguesa 10, Pinchito 6, Montadito 5, Chorizo 8, Filete 12. Libre ahora mismo: 54.

Cola (ya ordenada): `#133` (forzado, cerca del máximo de espera, 4× Chorizo = 32), `#126` (1× Montadito + 2× Filete = 29), `#131` (3× Hamburguesa = 30).

1. `#133` es forzado → entra primero: 4× Chorizo (32). Libre: 22.
2. `#126`: 1× Montadito + 2× Filete = 5 + 24 = 29 → no cabe entero. Se evalúa línea a línea: Montadito (5) cabe → entra. Libre: 17. Filete (24) no cabe → se salta esa línea (no bloquea el resto de la cola).
3. `#131`: 3× Hamburguesa = 30 → no cabe. Línea a línea no ayuda (es una sola línea de 30). Se salta.
4. Bonus del Paso 4: no hay más Chorizo ni Montadito pendientes que quepan en los 17 libres restantes.

**Sugerencia resultante**: 4× Chorizo (#133) + 1× Montadito (#126), usa 37/100, quedan 17 libres. El Filete de `#126` y la Hamburguesa de `#131` esperan a la siguiente vuelta, cuando se libere más espacio.

## Fuera de alcance del MVP (posibles mejoras v2)

- Optimización exacta (bin-packing / mochila) en vez de greedy, si la heurística demuestra dejar demasiada capacidad desaprovechada en la práctica.
- Ponderar el tiempo de cocción restante como criterio de desempate fino (ej. evitar mezclar cocciones muy cortas con muy largas si deja la plancha desaprovechada al final).
- Anticipar huecos futuros (cuándo se liberará capacidad) en vez de recalcular solo de forma reactiva.

## Nota de implementación

Al no existir backend compartido (Firebase Spark, sin Cloud Functions — ver `ARCHITECTURE.md`), este algoritmo se reimplementa de forma independiente en Angular, SwiftUI y Jetpack Compose. Para evitar que las tres versiones diverjan en su comportamiento, se mantiene un conjunto de **casos de prueba compartidos** en [`algorithm-spec/`](./algorithm-spec/) (entrada + sugerencia esperada, incluyendo el ejemplo de arriba y los casos de overflow y división) que cada implementación debe superar.
