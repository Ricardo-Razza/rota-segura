import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { cargaPorChave } from './carga';

describe('cargaPorChave', () => {
  function montar() {
    const chave = signal<number | null>(1);
    const pedidos = new Map<number, Subject<string[]>>();
    const consulta = TestBed.runInInjectionContext(() =>
      cargaPorChave(
        () => chave(),
        (k) => {
          const resposta = new Subject<string[]>();
          pedidos.set(k, resposta);
          return resposta;
        },
        { vazio: (d) => d.length === 0 },
      ),
    );
    TestBed.tick();
    return { chave, pedidos, consulta };
  }

  it('entrega o dado da chave pedida, com os estados do card', () => {
    const { pedidos, consulta } = montar();
    expect(consulta.estado()).toBe('carregando');
    pedidos.get(1)!.next(['um']);
    expect(consulta.dados()).toEqual(['um']);
    expect(consulta.estado()).toBe('ok');
  });

  it('ao mudar a chave, o dado anterior some enquanto o novo carrega', () => {
    const { chave, pedidos, consulta } = montar();
    pedidos.get(1)!.next(['um']);
    chave.set(2);
    TestBed.tick();
    expect(consulta.dados()).toBeNull();
    expect(consulta.estado()).toBe('carregando');
    pedidos.get(2)!.next([]);
    expect(consulta.estado()).toBe('vazio');
  });

  it('se a busca da nova chave falhar, é erro, e não o dado antigo desatualizado', () => {
    const { chave, pedidos, consulta } = montar();
    pedidos.get(1)!.next(['um']);
    chave.set(2);
    TestBed.tick();
    pedidos.get(2)!.error(new Error('falhou'));
    expect(consulta.dados()).toBeNull();
    expect(consulta.estado()).toBe('erro');
  });

  it('falha ao recarregar a mesma chave mantém o dado, marcado como desatualizado', () => {
    const { pedidos, consulta } = montar();
    pedidos.get(1)!.next(['um']);
    consulta.recarregar(true);
    TestBed.tick();
    pedidos.get(1)!.error(new Error('falhou'));
    expect(consulta.dados()).toEqual(['um']);
    expect(consulta.estado()).toBe('desatualizado');
  });

  it('sem chave não busca nada', () => {
    const { chave, consulta } = montar();
    chave.set(null);
    TestBed.tick();
    expect(consulta.dados()).toBeNull();
    expect(consulta.carregando()).toBe(false);
  });
});
