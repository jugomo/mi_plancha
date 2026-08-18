// Implementación literal de ALGORITHM.md (Pasos 1-4). Función pura, sin
// dependencias de Firebase, para poder probarla contra los casos de
// algorithm-spec/ y para que el cálculo en sí sea trivial de auditar.
//
// Dos correcciones respecto al pseudocódigo de ALGORITHM.md, encontradas al
// verificar contra los 4 casos de algorithm-spec/ (quedan documentadas aquí
// porque el pseudocódigo del propio ALGORITHM.md no las refleja todavía):
//
// 1. `libre_base` y `libre_extendida` no son dos reservas independientes que
//    cada rama decrementa por su cuenta — hay una sola plancha física, así
//    que ambas se recalculan siempre a partir del mismo uso acumulado total
//    (`capacidadTotal - usoAcumulado` / `capacidadExtendida - usoAcumulado`).
//    Si no, una línea colocada vía overflow automático no reducía el hueco
//    "base" que veían los pedidos no forzados siguientes, dejándoles colarse
//    por una base que en realidad ya estaba agotada (ver caso 02).
// 2. `usandoOverflow` se calcula igual en las dos vías (automática y manual):
//    es true si, tras colocar la línea, el uso acumulado supera
//    `capacidadTotal` — no solo en la rama de "último recurso automático".

export interface IngredienteAlgoritmo {
  capacidadUnidad: number;
  tiempoCoccionSeg: number;
}

export interface LineaAlgoritmo {
  id: string;
  ingrediente: string;
  cantidad: number;
  estado: string;
  subgrupo?: number;
}

export interface PedidoAlgoritmo {
  id: string;
  creadoEn: number; // epoch ms
  subgrupoActual?: number;
  lineas: LineaAlgoritmo[];
}

export interface EntradaAlgoritmo {
  ahora: number; // epoch ms
  planchaCapacidadTotal: number;
  overflowPorcentaje: number; // ej. 10 = +10%
  overflowManualActivo: boolean;
  capacidadUsadaActual: number;
  tiempoMaximoEsperaMin: number;
  division: { umbral: number; tamanoSubgrupo: number };
  ingredientes: Record<string, IngredienteAlgoritmo>;
  pedidos: PedidoAlgoritmo[];
}

export interface ItemSugerencia {
  pedidoId: string;
  lineaId: string;
  ingrediente: string;
  cantidad: number;
  usandoOverflow: boolean;
}

export interface SalidaAlgoritmo {
  sugerencia: ItemSugerencia[];
  capacidadUsadaResultante: number;
  alertas: string[];
}

interface CandidatoPedido {
  pedido: PedidoAlgoritmo;
  urgencia: number;
  forzado: boolean;
}

export function calcularSugerencia(entrada: EntradaAlgoritmo): SalidaAlgoritmo {
  const capacidadDe = (ingredienteId: string, cantidad: number): number =>
    (entrada.ingredientes[ingredienteId]?.capacidadUnidad ?? 0) * cantidad;

  // --- Paso 1: urgencia y forzado ---
  const tiempoMaximoEsperaMs = entrada.tiempoMaximoEsperaMin * 60_000;
  const conPendientes = entrada.pedidos.filter((p) => p.lineas.some((l) => l.estado === 'pendiente'));
  const candidatos: CandidatoPedido[] = conPendientes.map((pedido) => {
    const tiempoEspera = entrada.ahora - pedido.creadoEn;
    const urgencia = tiempoMaximoEsperaMs > 0 ? tiempoEspera / tiempoMaximoEsperaMs : 0;
    return { pedido, urgencia, forzado: urgencia >= 1 };
  });

  // --- Paso 2: cola ordenada (forzados por urgencia desc, luego FIFO) ---
  const cola = [...candidatos].sort((a, b) => {
    if (a.forzado !== b.forzado) return a.forzado ? -1 : 1;
    if (a.forzado) return b.urgencia - a.urgencia;
    return a.pedido.creadoEn - b.pedido.creadoEn;
  });

  // --- Paso 3: selección greedy por capacidad, con overflow ---
  const capacidadExtendida = entrada.planchaCapacidadTotal * (1 + entrada.overflowPorcentaje / 100);
  let usoAcumulado = entrada.capacidadUsadaActual;

  const libreBase = (): number => Math.max(0, entrada.planchaCapacidadTotal - usoAcumulado);
  const libreExtendida = (): number => Math.max(0, capacidadExtendida - usoAcumulado);
  const libreActual = (): number => (entrada.overflowManualActivo ? libreExtendida() : libreBase());

  const sugerencia: ItemSugerencia[] = [];
  const alertas: string[] = [];
  const idsSugeridos = new Set<string>();

  const incluir = (pedidoId: string, linea: LineaAlgoritmo): void => {
    const necesaria = capacidadDe(linea.ingrediente, linea.cantidad);
    usoAcumulado += necesaria;
    sugerencia.push({
      pedidoId,
      lineaId: linea.id,
      ingrediente: linea.ingrediente,
      cantidad: linea.cantidad,
      usandoOverflow: usoAcumulado > entrada.planchaCapacidadTotal,
    });
    idsSugeridos.add(linea.id);
  };

  for (const { pedido, forzado } of cola) {
    const subgrupoActual = pedido.subgrupoActual ?? 1;
    const lineasCandidatas = pedido.lineas.filter(
      (l) => l.estado === 'pendiente' && (l.subgrupo ?? 1) === subgrupoActual,
    );

    for (const linea of lineasCandidatas) {
      const necesaria = capacidadDe(linea.ingrediente, linea.cantidad);

      if (necesaria <= libreActual()) {
        incluir(pedido.id, linea);
      } else if (forzado && !entrada.overflowManualActivo && necesaria <= libreExtendida()) {
        // Último recurso automático — solo para pedidos forzados, y solo si
        // no estamos ya en modo manual (ahí `libreActual()` ya es la extendida).
        incluir(pedido.id, linea);
      } else if (forzado) {
        // Solo el id del pedido — el mensaje legible (con mesa, etc.) se
        // compone en la capa de presentación, que sí conoce ese contexto.
        alertas.push(pedido.id);
      }
      // Si no es forzado y no cabe, se salta sin bloquear el resto de la cola.
    }
  }

  // --- Paso 4: bonus de agrupación por tipo de ingrediente ---
  const tiposYaIncluidos = new Set(sugerencia.map((s) => s.ingrediente));
  for (const { pedido } of cola) {
    const subgrupoActual = pedido.subgrupoActual ?? 1;
    for (const linea of pedido.lineas) {
      if (linea.estado !== 'pendiente') continue;
      if ((linea.subgrupo ?? 1) !== subgrupoActual) continue;
      if (idsSugeridos.has(linea.id)) continue;
      if (!tiposYaIncluidos.has(linea.ingrediente)) continue;

      const necesaria = capacidadDe(linea.ingrediente, linea.cantidad);
      if (necesaria <= libreActual()) {
        incluir(pedido.id, linea);
      }
    }
  }

  return { sugerencia, capacidadUsadaResultante: usoAcumulado, alertas };
}
