import { DestroyRef, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, Subscription, map } from 'rxjs';
import { EstadoCard } from '../../shared/ui/chart-card';

export interface Carga<T> {
  /** Último dado recebido (mantido durante recargas silenciosas e depois de erro, para não piscar). */
  readonly dados: Signal<T | null>;
  /** Estado para o chart-card: carregando, vazio, erro, ok ou desatualizado. */
  readonly estado: Signal<EstadoCard>;
  readonly atualizadoEm: Signal<Date | null>;
  readonly carregando: Signal<boolean>;
  /** Busca de novo. Silenciosa = mantém os dados na tela enquanto busca (uso em eventos SSE). */
  recarregar(silenciosa?: boolean): void;
}

export interface OpcoesCarga<T> {
  /** Quando o dado conta como "sem dados para os filtros". */
  vazio?: (dados: T) => boolean;
  /** Quando o dado está desatualizado (padrão: campo `desatualizado` da resposta). */
  desatualizado?: (dados: T) => boolean;
}

function desatualizadoPadrao(dados: unknown): boolean {
  return (
    typeof dados === 'object' &&
    dados !== null &&
    (dados as { desatualizado?: unknown }).desatualizado === true
  );
}

/**
 * Como {@link carga}, para dados de "um item escolhido" (veículo, aluno, dia): o resultado só vale para a
 * chave pedida. O de outra chave não aparece enquanto a nova carrega nem se a busca dela falhar.
 */
export function cargaPorChave<K extends string | number, T>(
  chave: () => K | null,
  buscar: (chave: K) => Observable<T>,
  opcoes: OpcoesCarga<T> = {},
): Carga<T> {
  const base = carga<{ chave: K; valor: T }>(
    () => {
      const atual = chave();
      return atual === null ? null : buscar(atual).pipe(map((valor) => ({ chave: atual, valor })));
    },
    {
      vazio: (d) => opcoes.vazio?.(d.valor) ?? false,
      desatualizado: (d) => (opcoes.desatualizado ?? desatualizadoPadrao)(d.valor),
    },
  );
  const dados = computed<T | null>(() => {
    const recebido = base.dados();
    return recebido !== null && recebido.chave === chave() ? recebido.valor : null;
  });
  const estado = computed<EstadoCard>(() => {
    if (dados() !== null) {
      return base.estado();
    }
    if (base.carregando()) {
      return 'carregando';
    }
    return chave() === null ? 'vazio' : 'erro';
  });
  return { ...base, dados, estado };
}

/**
 * Liga uma fonte HTTP aos quatro estados do card. A função `fonte` é reavaliada sempre que algum
 * signal lido dentro dela muda (ex.: filtros globais), cancelando a requisição anterior.
 * Precisa ser criada num contexto de injeção (campo de componente).
 */
export function carga<T>(fonte: () => Observable<T> | null, opcoes: OpcoesCarga<T> = {}): Carga<T> {
  const destroyRef = inject(DestroyRef);
  const dados = signal<T | null>(null);
  const falhou = signal(false);
  const carregando = signal(true);
  const atualizadoEm = signal<Date | null>(null);
  const gatilho = signal(0);
  let silenciosa = false;
  let assinatura: Subscription | null = null;

  effect(() => {
    gatilho();
    const observavel = fonte();
    untracked(() => {
      assinatura?.unsubscribe();
      assinatura = null;
      if (observavel === null) {
        // Fonte inativa (ex.: nenhum item selecionado): nada a buscar.
        dados.set(null);
        falhou.set(false);
        carregando.set(false);
        return;
      }
      if (!silenciosa) {
        carregando.set(true);
      }
      silenciosa = false;
      assinatura = observavel.subscribe({
        next: (valor) => {
          dados.set(valor);
          falhou.set(false);
          carregando.set(false);
          atualizadoEm.set(new Date());
        },
        error: () => {
          falhou.set(true);
          carregando.set(false);
        },
      });
    });
  });
  destroyRef.onDestroy(() => assinatura?.unsubscribe());

  const estado = computed<EstadoCard>(() => {
    const valor = dados();
    if (carregando() && valor === null) {
      return 'carregando';
    }
    if (falhou()) {
      // Com dado antigo na tela, avisa que está desatualizado em vez de apagar tudo.
      return valor === null ? 'erro' : 'desatualizado';
    }
    if (carregando()) {
      return 'carregando';
    }
    if (valor === null || (opcoes.vazio?.(valor) ?? false)) {
      return 'vazio';
    }
    return (opcoes.desatualizado ?? desatualizadoPadrao)(valor) ? 'desatualizado' : 'ok';
  });

  return {
    dados: dados.asReadonly(),
    estado,
    atualizadoEm: atualizadoEm.asReadonly(),
    carregando: carregando.asReadonly(),
    recarregar(silencio = false) {
      silenciosa = silencio;
      if (!silencio) {
        dados.set(null);
      }
      gatilho.update((n) => n + 1);
    },
  };
}
