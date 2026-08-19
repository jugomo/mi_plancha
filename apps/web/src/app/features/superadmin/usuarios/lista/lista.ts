import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { combineLatest, map } from 'rxjs';

import { Empresa } from '../../../../core/empresa';
import { Sesion } from '../../../../core/sesion';
import { UsuarioFila, UsuariosService } from '../../../../core/usuarios.service';
import { EmpresasService } from '../../empresas/empresas.service';

interface FilaConEmpresa extends UsuarioFila {
  empresaNombre: string;
}

@Component({
  selector: 'mp-superadmin-usuarios-lista',
  imports: [RouterLink],
  templateUrl: './lista.html',
  styleUrl: './lista.scss',
})
export class Lista {
  private readonly servicio = inject(UsuariosService);
  private readonly empresasService = inject(EmpresasService);
  private readonly sesion = inject(Sesion);

  protected readonly usuarios = toSignal(
    combineLatest([this.servicio.listarTodos(), this.empresasService.listar()]).pipe(
      map(([usuarios, empresas]: [UsuarioFila[], Empresa[]]) => {
        const nombrePorId = new Map(empresas.map((e) => [e.id, e.nombre]));
        return usuarios
          .filter((u) => u.rol !== 'superadmin')
          .map((u) => ({ ...u, empresaNombre: u.empresaId ? (nombrePorId.get(u.empresaId) ?? u.empresaId) : '—' }));
      }),
    ),
    { initialValue: [] as FilaConEmpresa[] },
  );

  protected readonly ocupado = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  esMiPropioUsuario(usuario: UsuarioFila): boolean {
    return usuario.id === this.sesion.usuario()?.uid;
  }

  async cambiarRol(usuario: UsuarioFila, rol: 'camarero' | 'cocinero'): Promise<void> {
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

  async eliminar(usuario: UsuarioFila): Promise<void> {
    if (!confirm(`¿Borrar a ${usuario.nombre}? No podrá volver a iniciar sesión.`)) return;
    this.error.set(null);
    this.ocupado.set(usuario.id);
    try {
      await this.servicio.eliminar(usuario.id);
    } catch {
      this.error.set('No se pudo borrar. Inténtalo de nuevo.');
      this.ocupado.set(null);
    }
  }
}
