import { Component, computed, input, output } from '@angular/core';

@Component({
  selector: 'mp-topbar',
  imports: [],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  readonly titulo = input.required<string>();
  readonly empresaNombre = input<string>('');
  // = usuarios/{uid}.empresaId (ver DATA_MODEL.md: es el mismo valor que el id
  // del documento empresas/{codigo}, no un campo aparte).
  readonly empresaCodigo = input<string>('');
  readonly nombre = input<string>('');
  // Opcional: camarero/cocinero ya lo llevan en `titulo` ("mi_plancha ·
  // Camarero"), así que aquí no pasan nada y no se duplica junto al nombre.
  readonly rolLabel = input<string>('');
  readonly cerrarSesion = output<void>();

  protected readonly etiquetaEmpresa = computed(() => {
    const nombre = this.empresaNombre();
    if (!nombre) return '';
    const codigo = this.empresaCodigo();
    return codigo ? `${nombre} · ${codigo}` : nombre;
  });

  protected readonly etiquetaUsuario = computed(() => {
    const nombre = this.nombre();
    const rol = this.rolLabel();
    return rol ? `${nombre} · ${rol}` : nombre;
  });
}
