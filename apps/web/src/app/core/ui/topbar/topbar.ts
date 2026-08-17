import { Component, input, output } from '@angular/core';

@Component({
  selector: 'mp-topbar',
  imports: [],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {
  readonly titulo = input.required<string>();
  readonly nombre = input<string>('');
  readonly rolLabel = input.required<string>();
  readonly cerrarSesion = output<void>();
}
