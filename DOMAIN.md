# Dominio — mi_plancha

## Visión del producto

Sistema de gestión de cocina en tiempo real para optimizar el uso de una plancha de carne compartida: maximizar su uso mientras se sirven los pedidos respetando (con flexibilidad) el orden de llegada. Arquitectura híbrida: web app + apps móviles (misma funcionalidad, distinta tecnología) sobre una API común.

## Roles y autenticación

- **Camarero**: crea pedidos, ve su estado en tiempo real, es responsable único de sus pedidos.
- **Cocinero**: ve pedidos pendientes, selecciona uno (queda asignado en exclusiva), coloca productos en la plancha, marca ítems cocinados.
- **Administrador**: gestiona configuración vía CMS.
- Sistema de autenticación con rol por usuario, que determina la interfaz mostrada.
- Un usuario puede cambiar a otro rol **en modo solo lectura** para consultar estados.

## Entidades del dominio

| Entidad | Campos clave | Definido en |
|---|---|---|
| **Mesa** | número de mesa | CMS (administrador) |
| **Cliente** | mesa ocupada, nombre de pila, timestamp de apertura, pedidos asociados | Camarero |
| **Producto** | nombre, capacidad consumida (unidades), tiempo de cocción, stock actual, precio | CMS (administrador) |
| **Pedido** | cliente asociado, camarero responsable, timestamp de creación, líneas de productos, prioridad, estado derivado | Camarero |
| **Cuenta** | cliente y mesa de origen (conservados aunque el cliente se borre), listado de pedidos con su suma, total, timestamp de generación | Camarero (al generar cuenta) |
| **Línea de pedido** | producto, cantidad, estado (pendiente / en plancha / pendiente de entrega / listo), cocinero asignado | — |
| **Plancha** | capacidad total (ej. 100 unidades), capacidad usada en tiempo real | CMS (única, capacidad configurable) |
| **Config. de división** | umbral de tamaño de pedido, tamaño de subgrupo | CMS |
| **Config. anti-inanición** | tiempo máximo de espera por pedido | CMS |
| **Config. de overflow** | porcentaje de capacidad extra temporal (ej. +10%) | CMS |

## Flujo funcional principal

1. El camarero **abre un cliente**: elige una mesa libre (de las definidas en el CMS) y le da un nombre de pila, para poder identificarlo y reutilizar la mesa después. La mesa queda ocupada mientras el cliente exista en el sistema.
2. El camarero crea uno o varios pedidos para ese cliente, cada uno con sus productos/cantidades. Un mismo cliente puede acumular varios pedidos mientras está en el sistema (ej. una ronda y luego otra).
3. El sistema ordena por prioridad de llegada, con **reordenamiento flexible**: puede adelantar pedidos más pequeños llegados después si el pedido más antiguo no cabe en ese momento en la plancha o si optimiza mejor el tiempo total.
4. El cocinero ve los pedidos pendientes y una **sugerencia activa** de qué productos cocinar juntos ahora mismo, maximizando el uso de la plancha (capacidad + tiempos de cocción + prioridad).
5. El cocinero selecciona un pedido → queda asignado en exclusiva a él (solo él puede completarlo).
6. El cocinero toca cada producto que coloca físicamente en la plancha → el ítem pasa a "en plancha", se descuenta stock en ese momento y arranca su temporizador de cocción.
7. El sistema avisa en tiempo real cuándo un producto terminó su cocción; el cocinero decide visualmente cuándo retirarlo, y al hacerlo el ítem pasa a "pendiente de entrega" — todavía no es "listo".
8. Si el pedido supera el umbral de división configurado en el CMS, se puede preparar y entregar por subgrupos sin esperar a que esté completo.
9. El camarero ve en tiempo real el estado de los pedidos de su cliente (faltan productos / en cocción / pendiente de entrega / listo). Cuando ve un ítem "pendiente de entrega", lo lleva físicamente a la mesa y lo confirma en la app; ahí pasa a "listo" (ver [ARCHITECTURE.md](./ARCHITECTURE.md#máquina-de-estados-de-una-línea-de-pedido)).
10. Cuando el cliente termina, el camarero **genera la cuenta**: un listado con la suma de cada uno de sus pedidos y el total. Al generarla, el cliente se elimina del sistema y su mesa vuelve a quedar libre para un nuevo cliente.

## Reglas de negocio clave

- Una única plancha, pero **varios cocineros pueden trabajar sobre ella simultáneamente** (capacidad compartida y global).
- Un pedido, una vez seleccionado, solo puede completarlo el cocinero que lo tomó.
- Varios camareros pueden introducir pedidos en paralelo; cada pedido es responsabilidad única de su camarero.
- El stock se descuenta al colocar el producto en la plancha (no al crear el pedido).
- Si se agota el stock de un producto pedido, se emite una alerta visual tanto al cocinero como al camarero responsable de ese pedido.
- **Anti-inanición**: cada pedido tiene un tiempo máximo de espera configurable en el CMS. Si un pedido se acerca a ese límite, el sistema debe forzar su priorización aunque no sea el encaje óptimo de plancha en ese momento.
- **Overflow de capacidad**: el CMS define un porcentaje de capacidad extra temporal (ej. +10%) para momentos de alta demanda; usarlo implica que el cocinero coloca los productos más juntos físicamente sobre la plancha. Se puede activar de dos formas, no excluyentes:
  - **Manual**: el cocinero lo activa/desactiva cuando lo considera oportuno (ej. hora punta).
  - **Automática**: el sistema recurre a él como último recurso para encajar un pedido en estado forzado por anti-inanición que de otro modo no cabría.
  - La capacidad efectiva nunca supera `capacidad_total × (1 + porcentaje_overflow)`.
- Una mesa solo puede tener un cliente activo a la vez; no se puede abrir un cliente nuevo en una mesa ya ocupada.
- Un cliente existe en el sistema desde que el camarero lo abre hasta que le genera la cuenta; mientras tanto puede acumular varios pedidos.
- **Generar cuenta** es una acción exclusiva del camarero: produce un listado con la suma de cada pedido del cliente (líneas × precio del producto) y el total. Es solo informativo — no implica cobro ni pago (fuera de alcance de este MVP, ver más abajo). Al generarse, el cliente se borra del sistema y su mesa queda libre, pero **la cuenta queda guardada como registro histórico permanente** (no se elimina) — es la única parte de todo el flujo que se conserva a propósito para consulta futura.

## Alcance de la primera versión (MVP)

- **Incluye**: flujo operativo completo (cliente → pedido → plancha → listo → entrega → cuenta), control de stock, autenticación por rol, CMS básico de configuración (incluye alta de mesas), conservación del histórico de cuentas generadas.
- **Excluye** (fases futuras): cobro/pago real de la cuenta, analítica/reportes sobre el histórico, múltiples planchas.
