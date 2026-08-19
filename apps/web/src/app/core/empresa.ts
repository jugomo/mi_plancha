import { Timestamp } from 'firebase/firestore';

/**
 * Entidad por encima de todo (ver DATA_MODEL.md): cada `empresas/{codigo}` es
 * un restaurante independiente, con su propio administrador, personal y
 * datos operativos, todos anidados bajo `empresas/{codigo}/...`.
 */
export interface Empresa {
  id: string; // = codigo, ver EmpresasService.generarCodigoUnico()
  codigo: string;
  nombre: string;
  activa: boolean;
  creadaEn: Timestamp;
}
