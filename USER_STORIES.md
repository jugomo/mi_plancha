# Historias de usuario — mi_plancha

Para el detalle de dominio, algoritmo y datos que respaldan los criterios de aceptación, ver [DOMAIN.md](./DOMAIN.md), [ALGORITHM.md](./ALGORITHM.md) y [DATA_MODEL.md](./DATA_MODEL.md). Para las pantallas, ver el wireframe navegable enlazado desde la conversación de diseño.

Convención de IDs: `CAM-` camarero, `COC-` cocinero, `ADM-` administrador, `SA-` superadmin, `GEN-` transversal (cualquier rol).

## Priorización

Las 22 historias son todas parte del alcance del MVP definido en `DOMAIN.md` — no hay ninguna que sobre. La priorización de abajo no es "qué se corta", sino **en qué orden se construye**, agrupando por qué se rompería si faltara:

### P0 — Núcleo operativo mínimo (sin esto no hay app)
El ciclo completo pedido → plancha → entrega → cuenta, funcionando de la forma más simple posible (sin inteligencia todavía: el cocinero decide todo a ojo, como hace hoy sin la app).

`GEN-01`, `SA-01`, `SA-02`, `SA-03`, `SA-04`, `ADM-01`, `ADM-02`, `ADM-06`, `ADM-07`, `CAM-01`, `CAM-02`, `CAM-03`, `CAM-04`, `CAM-06`, `CAM-07`, `COC-01`, `COC-03`, `COC-04`, `COC-05`, `COC-06`

`SA-*` va antes que `ADM-07`: sin una empresa creada por el superadmin no existe ningún administrador con quien empezar — es el primer eslabón de toda la cadena de altas (superadmin → administrador de una empresa → camarero/cocinero de esa empresa).

### P1 — El diferenciador del producto (no recortar: es la razón de ser de "mi_plancha")
Sin esto, lo construido en P0 es un comandero genérico más — la sugerencia activa es literalmente la idea original del proyecto ("optimizar y maximizar el uso de la plancha").

`COC-02` (sugerencia activa) · `CAM-05` (alerta de stock — barata de construir una vez existe P0, alto valor, por eso va aquí y no más abajo)

### P2 — Ajustes finos del algoritmo y del CMS
Refinan la sugerencia de P1 para los casos límite (pedidos que llevan esperando mucho, horas punta, pedidos muy grandes). El sistema ya es útil y coherente sin ellos el primer día — se pueden activar poco después sin rediseñar nada.

`ADM-04` + su reflejo en `COC-01`/`COC-02` (anti-inanición) · `ADM-05` + `COC-07` (overflow) · `ADM-03` + su reflejo en `CAM-04` (división de pedidos grandes) · `COC-08` (depende de que P2 anterior ya exista)

### P3 — Conveniencia, aplazable sin tensión
No bloquea ninguna operación real del día a día.

`GEN-02` (ver la app como otro rol en modo lectura) · `CAM-08` (pantalla de consulta, refleja datos que ya existen en otras pantallas)

## Transversal (`GEN-`)

### GEN-01 — Iniciar sesión
Como usuario del sistema, quiero iniciar sesión con las credenciales de mi rol, para acceder a la interfaz correspondiente.
- El sistema determina la interfaz a mostrar según `usuarios/{uid}.rol` (camarero / cocinero / administrador / superadmin).
- Superadmin y administrador inician sesión con email real + contraseña, en la pestaña "Administración".
- Camarero y cocinero inician sesión con código de empresa + usuario + contraseña, en la pestaña "Trabajador" (por defecto) — ver `DATA_MODEL.md`, "Login de camarero/cocinero".
- Si las credenciales son incorrectas, se muestra un error claro sin revelar cuál de los datos falló (ni email/contraseña, ni empresa/usuario/contraseña).
- Si mi empresa está desactivada (ver `SA-02`), no puedo iniciar sesión, ni seguir usando una sesión ya abierta.

### GEN-02 — Ver la app como otro rol (solo lectura)
Como usuario autenticado, quiero cambiar temporalmente a la vista de otro rol en modo solo lectura, para comprobar el estado del sistema desde su perspectiva sin poder actuar como él.
- Todas las pantallas del rol visualizado se muestran normalmente, pero cualquier acción de escritura queda bloqueada (las Security Rules ya lo garantizan: mis permisos reales, no los del rol que estoy visualizando, son los que aplican).
- Es evidente en la interfaz que estoy en modo "ver como", y puedo volver a mi rol real en un toque/clic.

## Superadmin (`SA-`)

### SA-01 — Crear una empresa con su administrador
Como superadmin, quiero dar de alta una empresa nueva junto con su administrador dedicado, para poner en marcha un restaurante independiente en el sistema.
- Se genera automáticamente un código único de empresa (1 letra mayúscula + 3 dígitos, ver `DATA_MODEL.md`), que necesitará después todo el personal de esa empresa para iniciar sesión.
- El administrador creado tiene, dentro de su empresa, los mismos privilegios que tenía el único administrador de la versión anterior (CMS completo + gestión de camarero/cocinero).
- Al terminar, veo el código de la empresa recién creada para compartirlo.

### SA-02 — Activar/desactivar una empresa
Como superadmin, quiero poder desactivar una empresa, para bloquear su acceso sin perder ninguno de sus datos.
- Desactivar (`activa: false`) impide iniciar sesión a todo su personal (administrador, camarero, cocinero) y cierra las sesiones ya abiertas.
- No es un borrado: todos sus datos (mesas, productos, pedidos, cuentas históricas) se conservan intactos, igual que `cuentas/` nunca se borra.
- Puedo reactivarla en cualquier momento y todo sigue donde estaba.

### SA-03 — Gestionar el administrador de cualquier empresa
Como superadmin, quiero poder editar o desactivar la cuenta de administrador de cualquier empresa, para poder recuperar el acceso si ese administrador pierde su contraseña (no hay recuperación por email en este sistema).

### SA-04 — Gestionar camarero/cocinero de cualquier empresa
Como superadmin, quiero poder añadir, editar y eliminar camareros y cocineros de cualquier empresa, con la misma capacidad que tiene el administrador de esa empresa sobre su propio personal.
- Al invitar, elijo primero a qué empresa pertenece el nuevo usuario.
- El listado muestra el personal de todas las empresas, con una columna que indica a cuál pertenece cada uno.

## Camarero (`CAM-`)

### CAM-01 — Abrir una mesa para un cliente
Como camarero, quiero abrir una mesa nueva con el nombre de pila del cliente, para empezar a tomarle pedidos.
- Solo puedo elegir mesas cuyo estado sea `libre` (definidas en el CMS).
- Al abrir la mesa, el cliente queda visible para el resto de camareros y cocineros del turno.
- Si intento abrir una mesa que ya está ocupada, la acción falla con un mensaje claro (ver transacción "Abrir mesa" en `DATA_MODEL.md`).

### CAM-02 — Ver mis mesas en tiempo real
Como camarero, quiero ver un panel en vivo con todas las mesas (libres y ocupadas, con cliente y resumen de pedidos), para saber de un vistazo qué necesita mi atención sin tener que refrescar nada.
- La lista se actualiza sola cuando cambia el estado de cualquier mesa o pedido (listener en tiempo real, no hace falta recargar).
- Cada mesa ocupada muestra: nombre del cliente, tiempo que lleva abierta, y un resumen del punto en que están sus pedidos — Esperando / En plancha / Pendiente entrega en mesa / Todo listo (el mismo vocabulario de línea que en CAM-04, resumido para toda la mesa) — para no tener que entrar a cada pedido a comprobarlo.

### CAM-03 — Crear un pedido para un cliente
Como camarero, quiero crear un pedido eligiendo productos y cantidades para la mesa de un cliente, para que la cocina empiece a prepararlo.
- Veo el stock disponible de cada producto al elegir cantidades.
- No puedo confirmar un pedido con más cantidad de un producto que el stock actual disponible.
- Un mismo cliente puede tener varios pedidos activos a la vez (ej. rondas sucesivas).

### CAM-04 — Ver el estado en tiempo real de un pedido
Como camarero, quiero ver de un vistazo en qué punto está un pedido completo, y el detalle de cada línea, a medida que cambia, para saber qué hacer sin tener que preguntar en cocina.
- El estado general del pedido es uno de: **Esperando** (todavía nadie en cocina lo ha tomado), **Cocinando** (un cocinero lo tiene asignado y lo está preparando), **Pendiente entrega en mesa** (al menos un producto ya está retirado de la plancha y a falta de llevarlo a la mesa) o **Entregado** (todo confirmado en mesa).
- Ya veo este mismo estado general, uno por pedido, en el listado de pedidos de un cliente (antes de entrar al detalle) — no hace falta abrir cada uno para saber en qué punto está.
- Cada línea, por separado, muestra su propio estado (pendiente / en plancha / pendiente de entrega / listo).
- Si el pedido está dividido en tandas (ver `config/division`), veo claramente qué tanda está en curso.
- Si algún producto del pedido tiene alerta de stock, la veo destacada en esta pantalla.

### CAM-05 — Recibir alerta de stock bajo/agotado
Como camarero, quiero ser avisado visualmente si un producto de un pedido mío se queda sin stock, para poder informar al cliente o proponerle una alternativa.
- La alerta aparece tanto en el panel de mesas como en el detalle del pedido afectado.
- La misma alerta la ve también el cocinero (`COC-08`), no soy el único informado.

### CAM-06 — Generar la cuenta de un cliente
Como camarero, quiero generar la cuenta de un cliente con la suma de todos sus pedidos, para poder cobrarle y liberar la mesa.
- El listado muestra cada pedido con su subtotal (líneas × precio del producto) y el total general.
- Al confirmar, el cliente se elimina del sistema y su mesa vuelve a `libre` (transacción "Generar cuenta" en `DATA_MODEL.md`).
- La cuenta generada queda guardada de forma permanente en el histórico (`cuentas/`), con los precios de ese momento — aunque el CMS cambie precios después, esta cuenta no se ve afectada.
- Esta acción es solo informativa: no gestiona cobro ni pago real (fuera de alcance de este MVP).
- Si el cliente abrió mesa pero no llegó a hacer ningún pedido, no hay nada que facturar — en su lugar veo un botón "Cerrar mesa" que libera la mesa y borra el cliente sin crear ningún registro en `cuentas/` (no tendría sentido un histórico de un importe de 0€).

### CAM-07 — Confirmar la entrega de un producto en mesa
Como camarero, quiero confirmar cuándo he entregado en la mesa un producto que el cocinero ya retiró de la plancha, para que quede constancia real de que el pedido ya llegó al cliente y no solo de que está preparado.
- Solo veo el botón de confirmar cuando el cocinero ya lo marcó "pendiente de entrega" — antes de eso no hay nada que confirmar.
- Al confirmar, la línea pasa a "listo" — es el estado final de la secuencia (ver `ARCHITECTURE.md`).
- Solo puedo confirmar la entrega de pedidos de los que soy el camarero responsable.

### CAM-08 — Ver mis pedidos completados
Como camarero, quiero consultar en una pantalla aparte los pedidos que ya he entregado del todo, para revisarlos sin que ocupen sitio en el panel de mesas en vivo.
- Un botón "Completados", accesible desde el panel de mesas, lleva a esta pantalla.
- Solo veo mis propios pedidos (de los que soy el camarero responsable) cuyas líneas están todas en "listo".
- Es solo de consulta: el borrado del pedido operativo, una vez facturado, es cosa del cocinero (`COC-01`), no mía.

## Cocinero (`COC-`)

### COC-01 — Ver los pedidos pendientes por prioridad
Como cocinero, quiero ver la cola de pedidos pendientes ordenada por prioridad, para saber qué debería tomar a continuación.
- El orden es FIFO por defecto, salvo pedidos marcados como forzados por anti-inanición, que aparecen primero.
- Cada pedido muestra desde cuándo espera y, si aplica, un aviso de que está cerca del tiempo máximo configurado.

### COC-02 — Ver la sugerencia activa de qué cocinar ahora
Como cocinero, quiero ver una sugerencia de qué productos colocar en la plancha ahora mismo, para aprovechar el espacio disponible sin tener que calcularlo yo mismo.
- La sugerencia se recalcula sola cuando cambia la capacidad libre, entra un pedido nuevo, o algún pedido cruza el umbral de anti-inanición (ver `ALGORITHM.md`).
- La sugerencia es orientativa: puedo ignorarla y colocar otra cosa si lo prefiero.
- Si la sugerencia usa capacidad extra (overflow), se indica claramente cuáles de sus productos la usan.

### COC-03 — Tomar un pedido
Como cocinero, quiero tomar un pedido pendiente para asignármelo, para empezar a prepararlo yo.
- Una vez lo tomo, ningún otro cocinero puede tomarlo ni completarlo (exclusividad garantizada por Security Rules, ver `firebase/firestore.rules`).
- Si otro cocinero se me adelanta por segundos, mi intento falla con un mensaje claro en vez de dejarme en un estado inconsistente.

### COC-04 — Colocar un producto en la plancha
Como cocinero, quiero marcar cuándo coloco físicamente un producto de mi pedido en la plancha, para que el sistema arranque su temporizador y descuente el stock.
- Solo puedo hacerlo en pedidos que yo mismo he tomado.
- El stock del producto se descuenta en el mismo instante (transacción "Colocar producto" en `DATA_MODEL.md`).
- Si el stock ya no alcanza, la acción falla con aviso claro.

### COC-05 — Ver la plancha en tiempo real
Como cocinero, quiero ver cuánta capacidad de la plancha está en uso ahora mismo y qué se está cocinando, para coordinarme con el resto de cocineros que comparten la misma plancha.
- Veo la capacidad usada frente al total, desglosada por tipo de producto.
- Veo un temporizador por cada producto en cocción, y aviso visual cuando está a punto de terminar.
- Si hay overflow en uso (manual o automático), la barra de capacidad lo muestra extendido más allá del 100%.

### COC-06 — Retirar un producto de la plancha
Como cocinero, quiero marcar un producto como retirado cuando decido que ya está listo, para que el camarero sepa que ya puede pasar a recogerlo y llevarlo a la mesa.
- El sistema me avisa cuando la cocción de un producto ha terminado, pero soy yo quien decide y confirma el momento de retirarlo.
- Al retirarlo, la línea pasa a "pendiente de entrega" — todavía no es "listo"; la entrega en mesa la confirma el camarero (`CAM-07`), no yo.
- Solo puedo retirar un producto que yo mismo coloqué en plancha, de un pedido que tengo asignado.

### COC-07 — Activar/desactivar el overflow manualmente
Como cocinero, quiero activar manualmente la capacidad extra de la plancha en momentos de mucha demanda, para poder apretar más productos de lo habitual cuando lo considere necesario, y desactivarla cuando ya no la necesite.
- Mientras está activo, se ve claramente en la pantalla de la plancha (toggle visible para todo el turno, no solo para mí).
- El límite nunca supera `capacidad_total × (1 + porcentaje_overflow)` configurado en el CMS.

### COC-08 — Recibir alerta cuando un pedido forzado no cabe
Como cocinero, quiero ser avisado si un pedido urgente por anti-inanición no cabe en la plancha ni usando el overflow automático, para poder liberar espacio manualmente cuanto antes.
- La alerta identifica el pedido concreto que no encaja.
- Deja de mostrarse en cuanto ese pedido consigue colocarse.

## Administrador (`ADM-`)

### ADM-01 — Gestionar productos
Como administrador, quiero dar de alta y editar productos (nombre, capacidad, tiempo de cocción, stock, precio), para mantener la carta y las reglas de la plancha al día.
- Los cambios de precio no afectan a cuentas ya generadas (snapshot histórico, ver `DATA_MODEL.md`).
- No puedo dejar capacidad, tiempo de cocción o precio en valores negativos.

### ADM-02 — Configurar la capacidad de la plancha
Como administrador, quiero definir la capacidad total de la plancha, para que el algoritmo de sugerencia y los cocineros trabajen con el límite real de mi cocina.

### ADM-03 — Configurar la división de pedidos grandes
Como administrador, quiero definir a partir de qué tamaño se puede dividir un pedido en tandas, y de qué tamaño son esas tandas, para que los pedidos grandes no obliguen al cliente a esperar a que esté todo listo de una vez.

### ADM-04 — Configurar el tiempo máximo de espera (anti-inanición)
Como administrador, quiero definir cuánto puede esperar un pedido como máximo antes de forzarse su preparación, para garantizar un límite de espera razonable a todos los clientes.

### ADM-05 — Configurar el porcentaje de overflow
Como administrador, quiero definir qué porcentaje de capacidad extra se puede usar en momentos de alta demanda, para dar margen de maniobra en horas punta sin comprometer la calidad del servicio.

### ADM-06 — Configurar el número de mesas
Como administrador, quiero definir cuántas mesas tiene el local, para que los camareros solo puedan abrir mesas que existen realmente.

### ADM-07 — Gestionar camarero/cocinero de mi empresa
Como administrador, quiero dar de alta, editar, desactivar y eliminar cuentas de camarero/cocinero **de mi propia empresa**, para controlar quién puede hacer qué en mi restaurante.
- Solo puedo gestionar camarero/cocinero — no puedo crear otro administrador (eso lo hace el superadmin al crear una empresa, `SA-01`) ni tocar personal de otra empresa.
- Al invitar, elijo un usuario y contraseña (no un email) — es lo que ese camarero/cocinero teclea para entrar, junto al código de mi empresa (ver `DATA_MODEL.md`).
- Desactivar un usuario (`activo: false`) le impide operar sin borrar su historial de acciones pasadas; eliminarlo le impide volver a iniciar sesión (el historial de pedidos/cuentas que ya generó no se ve afectado, esos quedan igual con su `uid` como autor).
- Mi propia cuenta de administrador no aparece en este listado — la gestiona el superadmin (`SA-03`).

## Fuera de alcance de esta versión (no hay historia todavía)

- **Consultar el histórico de cuentas** desde la app: las cuentas ya se guardan de forma permanente (`cuentas/`, ver `DATA_MODEL.md`), pero no hay todavía ninguna pantalla para listarlas o buscarlas — es una decisión pendiente para cuando se aborde analítica/reportes.
- Cobro/pago real de la cuenta, analítica/reportes, notificaciones push, múltiples planchas — ya excluidos en `DOMAIN.md`.
