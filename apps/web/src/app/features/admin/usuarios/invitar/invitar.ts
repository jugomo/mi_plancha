import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { Rol } from '../../../../core/sesion';
import { UsuariosService } from '../usuarios.service';

@Component({
  selector: 'mp-usuarios-invitar',
  imports: [FormsModule, RouterLink],
  templateUrl: './invitar.html',
  styleUrl: './invitar.scss',
})
export class Invitar {
  private readonly servicio = inject(UsuariosService);
  private readonly router = inject(Router);

  protected nombre = '';
  protected email = '';
  protected password = '';
  protected rol: Rol = 'camarero';

  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);

  async guardar(): Promise<void> {
    if (this.guardando()) return;
    this.error.set(null);
    this.guardando.set(true);
    try {
      await this.servicio.crear({
        nombre: this.nombre.trim(),
        email: this.email.trim(),
        password: this.password,
        rol: this.rol,
      });
      await this.router.navigateByUrl('/admin/usuarios');
    } catch (err) {
      this.error.set(this.mensajeError(err));
    } finally {
      this.guardando.set(false);
    }
  }

  private mensajeError(err: unknown): string {
    const codigo = err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : '';
    if (codigo === 'auth/email-already-in-use') return 'Ese email ya tiene una cuenta.';
    if (codigo === 'auth/weak-password') return 'La contraseña debe tener al menos 6 caracteres.';
    if (codigo === 'auth/invalid-email') return 'El email no es válido.';
    return 'No se pudo crear el usuario. Revisa los datos e inténtalo de nuevo.';
  }
}
