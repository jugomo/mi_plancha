// Verifica calcularSugerencia() contra los 4 casos "golden" de
// algorithm-spec/ (ver ALGORITHM.md) — la única fuente de verdad de que las
// tres implementaciones (Angular, SwiftUI, Jetpack Compose) coinciden.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { EntradaAlgoritmo, calcularSugerencia } from './algoritmo-sugerencia';

const DIR_CASOS = join(import.meta.dirname, '../../../../../algorithm-spec/cases');

interface LineaJson {
  id: string;
  producto: string;
  cantidad: number;
  estado: string;
  subgrupo?: number;
}

interface CasoJson {
  id: string;
  descripcion: string;
  input: {
    ahora: string;
    planchaCapacidadTotal: number;
    overflowPorcentaje: number;
    overflowManualActivo: boolean;
    capacidadUsadaActual: number;
    tiempoMaximoEsperaMin: number;
    productos: Record<string, { capacidadUnidad: number; tiempoCoccionSeg: number }>;
    pedidos: { id: string; creadoEn: string; subgrupoActual?: number; lineas: LineaJson[] }[];
  };
  output: {
    sugerencia: { pedidoId: string; lineaId: string; producto: string; cantidad: number; usandoOverflow: boolean }[];
    capacidadUsadaResultante: number;
    alertas: string[];
  };
}

function cargarCaso(archivo: string): CasoJson {
  return JSON.parse(readFileSync(join(DIR_CASOS, archivo), 'utf-8'));
}

function aEntrada(caso: CasoJson): EntradaAlgoritmo {
  const { input } = caso;
  return {
    ahora: Date.parse(input.ahora),
    planchaCapacidadTotal: input.planchaCapacidadTotal,
    overflowPorcentaje: input.overflowPorcentaje,
    overflowManualActivo: input.overflowManualActivo,
    capacidadUsadaActual: input.capacidadUsadaActual,
    tiempoMaximoEsperaMin: input.tiempoMaximoEsperaMin,
    division: { umbral: 0, tamanoSubgrupo: 0 }, // no lo usa calcularSugerencia directamente, va por pedido
    productos: input.productos,
    pedidos: input.pedidos.map((p) => ({
      id: p.id,
      creadoEn: Date.parse(p.creadoEn),
      subgrupoActual: p.subgrupoActual,
      lineas: p.lineas,
    })),
  };
}

const archivos = [
  '01-adelantamiento-basico.json',
  '02-overflow-automatico.json',
  '03-overflow-manual.json',
  '04-division-pedido-grande.json',
];

describe('calcularSugerencia (algorithm-spec/)', () => {
  for (const archivo of archivos) {
    const caso = cargarCaso(archivo);

    it(`${caso.id}: ${caso.descripcion}`, () => {
      const resultado = calcularSugerencia(aEntrada(caso));

      // La sugerencia se compara como conjunto (el orden no importa) — ver
      // algorithm-spec/README.md.
      const actual = [...resultado.sugerencia].sort((a, b) => a.lineaId.localeCompare(b.lineaId));
      const esperado = [...caso.output.sugerencia].sort((a, b) => a.lineaId.localeCompare(b.lineaId));
      expect(actual).toEqual(esperado);

      expect(resultado.capacidadUsadaResultante).toBe(caso.output.capacidadUsadaResultante);
      expect(resultado.alertas).toHaveLength(caso.output.alertas.length);
    });
  }
});
