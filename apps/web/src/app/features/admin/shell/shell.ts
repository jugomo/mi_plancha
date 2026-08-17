import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Sesion } from '../../../core/sesion';
import { Topbar } from '../../../core/ui/topbar/topbar';

@Component({
  selector: 'mp-admin-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Topbar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class AdminShell {
  protected readonly sesion = inject(Sesion);

  cerrarSesion(): void {
    void this.sesion.cerrarSesion();
  }
}
