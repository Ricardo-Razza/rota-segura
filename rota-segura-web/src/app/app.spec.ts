import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  it('monta a aplicação com a área de avisos', async () => {
    await TestBed.configureTestingModule({ imports: [App], providers: [provideRouter([])] }).compileComponents();
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('rs-toasts')).not.toBeNull();
  });

  it('carrega cada feature sob demanda e protege a área autenticada', () => {
    const area = routes.find((rota) => rota.path === '');

    expect(area?.canActivate?.length).toBe(1);
    const features = (area?.children ?? []).filter((rota) => rota.path);
    expect(features.map((rota) => rota.path)).toEqual([
      'dashboard',
      'presenca',
      'jornada',
      'veiculos',
      'alertas',
      'alunos',
      'relatorios',
    ]);
    expect(features.every((rota) => typeof rota.loadChildren === 'function')).toBe(true);
  });
});
