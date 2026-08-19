# firebase/

Configuración de Firebase del monorepo (plan Spark, ver [`../ARCHITECTURE.md`](../ARCHITECTURE.md)).

- **`firestore.rules`**: reglas de seguridad — ver [`../DATA_MODEL.md`](../DATA_MODEL.md) para el modelo que aplican.
- **`firestore.indexes.json`**: incluye el índice de *collection group* sobre `lineas` que necesita el algoritmo de sugerencia (`../ALGORITHM.md`) para consultar pedidos pendientes/en plancha sin leer cada pedido por separado.
- **`firebase.json`**: esqueleto de configuración (Hosting apuntando al build de `apps/web`). Es un placeholder — cuando se inicialice el proyecto real con `firebase init`, revisar en particular la ruta de `hosting.public`, que la CLI suele generar relativa a la ubicación de `firebase.json` y puede necesitar ajuste según dónde acabe viviendo este archivo.
- **`seed.js`**: script de bootstrap (primer administrador, config del CMS, mesas, productos de referencia) vía Admin SDK, ya que la CLI de Firebase no tiene comandos para escribir documentos Firestore sueltos. Requiere `service-account.json` (no versionado, ver `.gitignore`) generado desde Configuración del proyecto → Cuentas de servicio en la consola. El UID y nombre del primer administrador se pasan por variable de entorno (no van hardcodeados en el script). Uso: `npm install && ADMIN_UID=<uid> ADMIN_NOMBRE="<nombre>" npm run seed`.

## Proyecto real

- Project ID: `mi-plancha` (plan Spark)
- Apps registradas: Web, iOS (`com.jugomo.miplancha`), Android (`com.jugomo.miplancha`)
- Reglas e índices ya desplegados (`firebase deploy --only firestore:rules,firestore:indexes`)
