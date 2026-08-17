# firebase/

Configuración de Firebase del monorepo (plan Spark, ver [`../ARCHITECTURE.md`](../ARCHITECTURE.md)).

- **`firestore.rules`**: reglas de seguridad — ver [`../DATA_MODEL.md`](../DATA_MODEL.md) para el modelo que aplican.
- **`firestore.indexes.json`**: incluye el índice de *collection group* sobre `lineas` que necesita el algoritmo de sugerencia (`../ALGORITHM.md`) para consultar pedidos pendientes/en plancha sin leer cada pedido por separado.
- **`firebase.json`**: esqueleto de configuración (Hosting apuntando al build de `apps/web`). Es un placeholder — cuando se inicialice el proyecto real con `firebase init`, revisar en particular la ruta de `hosting.public`, que la CLI suele generar relativa a la ubicación de `firebase.json` y puede necesitar ajuste según dónde acabe viviendo este archivo.
