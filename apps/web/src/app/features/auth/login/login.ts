import { Component, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { FirebaseError } from 'firebase/app';
import { filter, firstValueFrom, take } from 'rxjs';

import { HOME_POR_ROL } from '../../../core/auth.guard';
import { Sesion, Usuario } from '../../../core/sesion';

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

  protected email = '';
  protected password = '';
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | null>(null);

  async enviar(): Promise<void> {
    if (this.enviando()) return;
    this.error.set(null);
    this.enviando.set(true);
    try {
      await this.sesion.iniciarSesion(this.email, this.password);
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

  // Nunca distingue entre "el email no existe" y "la contraseña es incorrecta"
  // (criterio de aceptación de GEN-01, ver USER_STORIES.md).
  private mensajeError(err: unknown): string {
    if (err instanceof FirebaseError) {
      if (err.code === 'auth/too-many-requests') {
        return 'Demasiados intentos. Espera un momento antes de volver a intentarlo.';
      }
      if (err.code === 'auth/network-request-failed') {
        return 'No hay conexión. Comprueba tu red e inténtalo de nuevo.';
      }
    }
    return 'Email o contraseña incorrectos.';
  }
}
