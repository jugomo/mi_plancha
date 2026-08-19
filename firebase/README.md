# firebase/

Configuración de Firebase del monorepo (plan Spark, ver [`../ARCHITECTURE.md`](../ARCHITECTURE.md)).

- **`firestore.rules`**: reglas de seguridad — ver [`../DATA_MODEL.md`](../DATA_MODEL.md) para el modelo que aplican.
- **`firestore.indexes.json`**: incluye el índice de *collection group* sobre `lineas` que necesita el algoritmo de sugerencia (`../ALGORITHM.md`) para consultar pedidos pendientes/en plancha sin leer cada pedido por separado.
- **`firebase.json`**: esqueleto de configuración (Hosting apuntando al build de `apps/web`). Es un placeholder — cuando se inicialice el proyecto real con `firebase init`, revisar en particular la ruta de `hosting.public`, que la CLI suele generar relativa a la ubicación de `firebase.json` y puede necesitar ajuste según dónde acabe viviendo este archivo.
- **`seed.js`**: script de bootstrap **del modelo single-tenant anterior** (config/mesas/productos en la raíz, sin `empresas/`) — obsoleto desde el multi-empresa (ver `../DATA_MODEL.md`), se conserva como referencia histórica pero no se puede ejecutar tal cual contra el modelo actual. El bootstrap de hoy es: crear a mano el primer `usuarios/{uid}` con `rol: 'superadmin'` y `empresaId: null` (ver `../ARCHITECTURE.md`), y desde ahí usar el propio CMS del superadmin para crear empresas — cada una configura sus productos/mesas/etc. desde su propio CMS de administrador, no por seed.

## Proyecto real

- Project ID: `mi-plancha` (plan Spark)
- Apps registradas: Web, iOS (`com.jugomo.miplancha`), Android (`com.jugomo.miplancha`)
- Reglas e índices desplegados vía `firebase deploy --only firestore:rules,firestore:indexes` — repetir tras cada cambio a `firestore.rules`/`firestore.indexes.json`, no es automático.
