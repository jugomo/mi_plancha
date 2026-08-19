import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { EmpresasService } from '../empresas.service';

@Component({
  selector: 'mp-empresa-formulario',
  imports: [FormsModule, RouterLink],
  templateUrl: './formulario.html',
  styleUrl: './formulario.scss',
})
export class Formulario {
  private readonly servicio = inject(EmpresasService);
  private readonly router = inject(Router);

  protected readonly codigo = inject(ActivatedRoute).snapshot.paramMap.get('codigo');
  protected readonly esEdicion = this.codigo !== null;

  // Alta: nombre de la empresa + los datos de su administrador dedicado.
  // Edición: solo se puede cambiar el nombre — el administrador se gestiona
  // aparte, desde /superadmin/usuarios (igual que el resto de su personal).
  protected nombreEmpresa = '';
  protected adminNombre = '';
  protected adminEmail = '';
  protected adminPassword = '';

  protected readonly cargando = signal(this.esEdicion);
  protected readonly guardando = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly codigoCreado = signal<string | null>(null);

  constructor() {
    if (this.codigo) {
      this.servicio
        .obtener(this.codigo)
        .then((empresa) => {
          if (!empresa) {
            this.error.set('No se encontró la empresa.');
            return;
          }
          this.nombreEmpresa = empresa.nombre;
        })
        .catch(() => this.error.set('No se pudo cargar la empresa.'))
        .finally(() => this.cargando.set(false));
    }
  }

  async guardar(): Promise<void> {
    if (this.guardando()) return;
    this.error.set(null);
    this.guardando.set(true);

    try {
      if (this.codigo) {
        await this.servicio.actualizarNombre(this.codigo, this.nombreEmpresa.trim());
        await this.router.navigateByUrl('/superadmin/empresas');
      } else {
        const codigo = await this.servicio.crearConAdmin(this.nombreEmpresa.trim(), {
          nombre: this.adminNombre.trim(),
          email: this.adminEmail.trim(),
          password: this.adminPassword,
        });
        // Se queda en la pantalla mostrando el código recién generado — es el
        // dato que el administrador necesita para su primer login por
        // código+usuario, y solo se genera una vez, aquí.
        this.codigoCreado.set(codigo);
      }
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
    return 'No se pudo guardar. Revisa los datos e inténtalo de nuevo.';
  }
}
