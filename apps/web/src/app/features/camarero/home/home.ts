import { Component, inject } from '@angular/core';

import { Topbar } from '../../../core/ui/topbar/topbar';
import { Sesion } from '../../../core/sesion';

@Component({
  selector: 'mp-camarero-home',
  imports: [Topbar],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class CamareroHome {
  protected readonly sesion = inject(Sesion);

  cerrarSesion(): void {
    void this.sesion.cerrarSesion();
  }
}
