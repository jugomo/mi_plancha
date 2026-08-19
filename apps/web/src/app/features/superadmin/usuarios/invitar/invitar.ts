import { Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Empresa } from '../../../../core/empresa';
import { UsuariosService } from '../../../../core/usuarios.service';
import { EmpresasService } from '../../empresas/empresas.service';

@Component({
  selector: 'mp-superadmin-usuarios-invitar',
  imports: [FormsModule, RouterLink],
  templateUrl: './invitar.html',
  styleUrl: './invitar.scss',
})
export class Invitar {
  private readonly servicio = inject(UsuariosService);
  private readonly router = inject(Router);

  protected readonly empresas = toSignal(inject(EmpresasService).listar(), { initialValue: [] as Empresa[] });

  protected empresaId = '';
  protected nombre = '';
  protected username = '';
  protected password = '';
  protected rol: 'camarero' | 'cocinero' = 'camarero';

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  async guardar(): Promise<void> {
    if (this.guardando() || !this.empresaId) return;
    this.error.set(null);
    this.guardando.set(true);
    try {
      await this.servicio.crearEnEmpresa(this.empresaId, {
        nombre: this.nombre.trim(),
        username: this.username.trim(),
        password: this.password,
        rol: this.rol,
      });
      await this.router.navigateByUrl('/superadmin/usuarios');
    } catch (err) {
      this.error.set(this.mensajeError(err));
    } finally {
      this.guardando.set(false);
    }
  }

  private mensajeError(err: unknown): string {
    const codigo = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
    if (codigo === 'auth/email-already-in-use') return 'Ese usuario ya existe en esa empresa.';
    if (codigo === 'auth/weak-password') return 'La contraseña debe tener al menos 6 caracteres.';
    if (codigo === 'auth/invalid-email') return 'Ese usuario tiene caracteres no válidos.';
    return 'No se pudo crear el usuario. Revisa los datos e inténtalo de nuevo.';
  }
}
