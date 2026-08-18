import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Rol, Sesion } from '../../../../core/sesion';
import { UsuarioFila, UsuariosService } from '../usuarios.service';

@Component({
  selector: 'mp-usuarios-lista',
  imports: [RouterLink],
  templateUrl: './lista.html',
  styleUrl: './lista.scss',
})
export class Lista {
  private readonly servicio = inject(UsuariosService);
  private readonly sesion = inject(Sesion);

  protected readonly usuarios = toSignal(this.servicio.listar(), { initialValue: [] as UsuarioFila[] });
  protected readonly ocupado = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  esMiPropioUsuario(usuario: UsuarioFila): boolean {
    return usuario.id === this.sesion.usuario()?.uid;
  }

  async cambiarRol(usuario: UsuarioFila, rol: Rol): Promise<void> {
    this.error.set(null);
    this.ocupado.set(usuario.id);
    try {
      await this.servicio.actualizarRol(usuario.id, rol);
    } catch {
      this.error.set('No se pudo cambiar el rol. Inténtalo de nuevo.');
    } finally {
      this.ocupado.set(null);
    }
  }

  async alternarActivo(usuario: UsuarioFila): Promise<void> {
    this.error.set(null);
    this.ocupado.set(usuario.id);
    try {
      await this.servicio.actualizarActivo(usuario.id, !usuario.activo);
    } catch {
      this.error.set('No se pudo actualizar. Inténtalo de nuevo.');
    } finally {
      this.ocupado.set(null);
    }
  }
}
