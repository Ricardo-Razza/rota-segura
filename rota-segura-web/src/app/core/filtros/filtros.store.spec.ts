import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { FiltrosStore, filtrosDaUrl } from './filtros.store';

@Component({ template: '' })
class Vazia {}

describe('FiltrosStore', () => {
  let router: Router;
  let store: FiltrosStore;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', component: Vazia }])] });
    router = TestBed.inject(Router);
    await router.navigateByUrl('/presenca?anoLetivo=2026&escolaId=3&turmaId=12');
    store = TestBed.inject(FiltrosStore);
  });

  it('começa com os filtros que estão na URL', () => {
    expect(store.filtros()).toEqual({ anoLetivo: 2026, escolaId: 3, anoEscolar: null, turmaId: 12 });
    expect(store.parametros()).toEqual({ anoLetivo: '2026', escolaId: '3', turmaId: '12' });
  });

  it('mudar um filtro reflete na URL sem perder os outros', async () => {
    await store.definir({ anoEscolar: '5 ANO' });

    expect(router.url).toContain('anoLetivo=2026');
    expect(router.url).toContain('escolaId=3');
    expect(router.url).toContain('anoEscolar=5%20ANO');
    expect(store.anoEscolar()).toBe('5 ANO');
  });

  it('trocar a escola limpa a turma', async () => {
    await store.definir({ escolaId: 8 });

    expect(store.escolaId()).toBe(8);
    expect(store.turmaId()).toBeNull();
    expect(router.url).not.toContain('turmaId');
  });

  it('acompanha a navegação (voltar, avançar, link colado)', async () => {
    await router.navigateByUrl('/jornada?escolaId=5');

    expect(store.filtros()).toEqual({ anoLetivo: null, escolaId: 5, anoEscolar: null, turmaId: null });
  });

  it('limpar remove todos os filtros da URL', async () => {
    await store.limpar();

    expect(router.url).toBe('/presenca');
    expect(store.parametros()).toEqual({});
  });

  it('ignora valores inválidos na URL', () => {
    const filtros = filtrosDaUrl(new URLSearchParams('anoLetivo=abc&escolaId=-1&turmaId=1.5&anoEscolar='));

    expect(filtros).toEqual({ anoLetivo: null, escolaId: null, anoEscolar: null, turmaId: null });
  });
});
