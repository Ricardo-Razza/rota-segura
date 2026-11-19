import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { OpcoesDeFiltro } from '../core/api/modelos';
import { FiltrosStore } from '../core/filtros/filtros.store';
import { ICONES, Icone } from '../shared/ui/icone';
import { PainelFiltros } from './painel-filtros';
import { DESTINOS, iniciais } from './shell';

@Component({ template: '' })
class Vazia {}

// Opções fictícias.
const OPCOES: OpcoesDeFiltro = {
  anoLetivo: 2026,
  desatualizado: false,
  escolas: [
    { id: 1, nome: 'Escola Modelo Norte' },
    { id: 2, nome: 'Escola Modelo Sul' },
  ],
  anosEscolares: ['1º ano', '2º ano'],
  etapas: ['INFANTIL', 'FUNDAMENTAL'],
  turnos: ['Matutino', 'Vespertino'],
  turmas: [
    { id: 10, nome: '1º A', escolaId: 1, anoEscolar: '1º ano' },
    { id: 20, nome: '2º B', escolaId: 2, anoEscolar: '2º ano' },
  ],
};

describe('PainelFiltros', () => {
  beforeEach(async () => {
    // jsdom não implementa <dialog>: o suficiente para abrir e fechar.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: '**', component: Vazia }])],
    });
    await TestBed.inject(Router).navigateByUrl('/dashboard?anoLetivo=2026');
  });

  function montar() {
    const fixture = TestBed.createComponent(PainelFiltros);
    fixture.componentRef.setInput('opcoes', OPCOES);
    fixture.componentRef.setInput('anosLetivos', [2026, 2025]);
    fixture.componentInstance.abrir();
    fixture.detectChanges();
    return fixture;
  }

  it('só muda a URL ao aplicar, e trocar a escola limpa a turma', async () => {
    const fixture = montar();
    const el: HTMLElement = fixture.nativeElement;
    const store = TestBed.inject(FiltrosStore);

    const [escola, turma] = Array.from(el.querySelectorAll('select'));
    turma.value = '10';
    turma.dispatchEvent(new Event('change'));
    escola.value = '2';
    escola.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    // Rascunho ainda não aplicado.
    expect(store.escolaId()).toBeNull();
    // Com a escola 2, só a turma dela aparece.
    expect(Array.from(turma.options).map((o) => o.textContent?.trim())).toEqual([
      'Todas as turmas',
      '2º B',
    ]);

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(store.filtros()).toEqual({
      anoLetivo: 2026,
      escolaId: 2,
      anoEscolar: null,
      turmaId: null,
    });
    expect(TestBed.inject(Router).url).toContain('escolaId=2');
  });

  it('limpar zera o rascunho', async () => {
    const fixture = montar();
    const el: HTMLElement = fixture.nativeElement;
    const limpar = Array.from(el.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Limpar',
    )!;
    limpar.click();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(TestBed.inject(FiltrosStore).anoLetivo()).toBeNull();
  });
});

describe('Shell: utilitários', () => {
  it('iniciais do usuário do painel', () => {
    expect(iniciais('Gestora Fictícia')).toBe('GF');
    expect(iniciais('  maria  ')).toBe('M');
    expect(iniciais(null)).toBe('?');
  });

  it('todo destino do menu tem ícone conhecido', () => {
    for (const d of DESTINOS) {
      expect(ICONES[d.icone]).toBeDefined();
    }
  });
});

describe('Icone', () => {
  it('desenha os traços do ícone e fica escondido do leitor de tela', () => {
    const fixture = TestBed.createComponent(Icone);
    fixture.componentRef.setInput('nome', 'sino');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;

    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.querySelectorAll('path').length).toBe(ICONES.sino.length);
  });
});
