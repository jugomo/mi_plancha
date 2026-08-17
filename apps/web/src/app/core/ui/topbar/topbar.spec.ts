import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Topbar } from './topbar';

describe('Topbar', () => {
  let component: Topbar;
  let fixture: ComponentFixture<Topbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Topbar],
    }).compileComponents();

    fixture = TestBed.createComponent(Topbar);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('titulo', 'mi_plancha');
    fixture.componentRef.setInput('rolLabel', 'Camarero');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('muestra el título y el rol', () => {
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('mi_plancha');
    expect(texto).toContain('Camarero');
  });

  it('emite cerrarSesion al pulsar el botón', () => {
    let emitido = false;
    component.cerrarSesion.subscribe(() => (emitido = true));

    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();

    expect(emitido).toBe(true);
  });
});
