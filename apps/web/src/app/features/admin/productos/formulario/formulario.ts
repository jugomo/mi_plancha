import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ProductoEntrada, ProductosService } from '../productos.service';

@Component({
  selector: 'mp-producto-formulario',
  imports: [FormsModule, RouterLink],
  templateUrl: './formulario.html',
  styleUrl: './formulario.scss',
})
export class Formulario {
  private readonly servicio = inject(ProductosService);
  private readonly router = inject(Router);

  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly esEdicion = this.id !== null;

  protected nombre = '';
  protected capacidadUnidad = 0;
  protected tiempoCoccionSeg = 0;
  protected stock = 0;
  protected precio = 0;

  protected readonly cargando = signal(this.esEdicion);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    if (this.id) {
      this.servicio
        .obtener(this.id)
        .then((producto) => {
          if (!producto) {
            this.error.set('No se encontró el producto.');
            return;
          }
          this.nombre = producto.nombre;
          this.capacidadUnidad = producto.capacidadUnidad;
          this.tiempoCoccionSeg = producto.tiempoCoccionSeg;
          this.stock = producto.stock;
          this.precio = producto.precio;
        })
        .catch(() => this.error.set('No se pudo cargar el producto.'))
        .finally(() => this.cargando.set(false));
    }
  }

  async guardar(): Promise<void> {
    if (this.guardando()) return;
    this.error.set(null);
    this.guardando.set(true);

    const datos: ProductoEntrada = {
      nombre: this.nombre.trim(),
      capacidadUnidad: this.capacidadUnidad,
      tiempoCoccionSeg: this.tiempoCoccionSeg,
      stock: this.stock,
      precio: this.precio,
    };

    try {
      if (this.id) {
        await this.servicio.actualizar(this.id, datos);
      } else {
        await this.servicio.crear(datos);
      }
      await this.router.navigateByUrl('/admin/productos');
    } catch {
      this.error.set('No se pudo guardar. Revisa los datos e inténtalo de nuevo.');
    } finally {
      this.guardando.set(false);
    }
  }
}
