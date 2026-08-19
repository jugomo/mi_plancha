import { Component, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { filter, firstValueFrom, take } from 'rxjs';

import { HOME_POR_ROL } from '../../../core/auth.guard';
import { Sesion, Usuario } from '../../../core/sesion';

type Pestana = 'empresa' | 'administracion';

@Component({
  selector: 'mp-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly sesion = inject(Sesion);
  private readonly router = inject(Router);

  // Creado en contexto de inyección (campo de clase) para poder usarlo luego
  // dentro de enviar(), donde toObservable() ya no tendría contexto propio.
  private readonly usuarioResuelto$ = toObservable(this.sesion.usuario);

  // Camarero/cocinero (pestaña "Trabajador": empresa+usuario) es la pestaña
  // por defecto: es el login del día a día. Administrador/superadmin siguen
  // con email real, en "Administración".
  protected pestana = signal<Pestana>('empresa');

  protected codigoEmpresa = '';
  protected username = '';
  protected email = '';
  protected password = '';

  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  cambiarPestana(pestana: Pestana): void {
    this.pestana.set(pestana);
    this.error.set(null);
  }

  async enviar(): Promise<void> {
    if (this.enviando()) return;
    this.error.set(null);
    this.enviando.set(true);
    try {
      if (this.pestana() === 'empresa') {
        await this.sesion.iniciarSesionEmpresa(this.codigoEmpresa.trim(), this.username, this.password);
      } else {
        await this.sesion.iniciarSesion(this.email, this.password);
      }
      const usuario = await firstValueFrom(
        this.usuarioResuelto$.pipe(
          filter((u): u is Usuario => !!u),
          take(1),
        ),
      );
      await this.router.navigateByUrl(HOME_POR_ROL[usuario.rol]);
    } catch (err) {
      this.error.set(this.mensajeError(err));
    } finally {
      this.enviando.set(false);
    }
  }

  // Nunca distingue cuál de los datos es el incorrecto (criterio de
  // aceptación de GEN-01, ver USER_STORIES.md) — ni entre email/contraseña,
  // ni entre empresa/usuario/contraseña.
  private mensajeError(err: unknown): string {
    if (err instanceof FirebaseError) {
      if (err.code === 'auth/too-many-requests') {
        return 'Demasiados intentos. Espera un momento antes de volver a intentarlo.';
      }
      if (err.code === 'auth/network-request-failed') {
        return 'No hay conexión. Comprueba tu red e inténtalo de nuevo.';
      }
    }
    return this.pestana() === 'empresa' ? 'Empresa, usuario o contraseña incorrectos.' : 'Email o contraseña incorrectos.';
  }
}
