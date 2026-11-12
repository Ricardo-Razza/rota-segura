import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Filtros globais do topo. Só ids e anos: nenhum dado pessoal vai para a URL. */
export interface FiltrosGlobais {
  anoLetivo: number | null;
  escolaId: number | null;
  anoEscolar: string | null;
  turmaId: number | null;
}

const VAZIO: FiltrosGlobais = { anoLetivo: null, escolaId: null, anoEscolar: null, turmaId: null };

function inteiro(valor: string | null): number | null {
  if (valor === null || !/^\d+$/.test(valor)) {
    return null;
  }
  return Number(valor);
}

/** Lê os filtros dos parâmetros da URL, ignorando valores inválidos. */
export function filtrosDaUrl(parametros: URLSearchParams): FiltrosGlobais {
  const anoEscolar = parametros.get('anoEscolar');
  return {
    anoLetivo: inteiro(parametros.get('anoLetivo')),
    escolaId: inteiro(parametros.get('escolaId')),
    anoEscolar: anoEscolar && anoEscolar.length <= 30 ? anoEscolar : null,
    turmaId: inteiro(parametros.get('turmaId')),
  };
}

/**
 * Estado dos filtros globais. A URL é a fonte da verdade: mudar um filtro navega com os
 * novos parâmetros, e o store se atualiza a cada navegação (inclusive voltar/avançar e links).
 */
@Injectable({ providedIn: 'root' })
export class FiltrosStore {
  private readonly router = inject(Router);
  private readonly _filtros = signal<FiltrosGlobais>(VAZIO);

  readonly filtros = this._filtros.asReadonly();
  readonly anoLetivo = computed(() => this._filtros().anoLetivo);
  readonly escolaId = computed(() => this._filtros().escolaId);
  readonly anoEscolar = computed(() => this._filtros().anoEscolar);
  readonly turmaId = computed(() => this._filtros().turmaId);
  /** Parâmetros prontos para enviar à API (sem os vazios). */
  readonly parametros = computed(() => {
    const saida: Record<string, string> = {};
    for (const [chave, valor] of Object.entries(this._filtros())) {
      if (valor !== null) {
        saida[chave] = String(valor);
      }
    }
    return saida;
  });

  constructor() {
    this.lerDaUrl(this.router.url);
    this.router.events
      .pipe(
        filter((evento): evento is NavigationEnd => evento instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((evento) => this.lerDaUrl(evento.urlAfterRedirects));
  }

  /** Altera um ou mais filtros. Trocar a escola limpa a turma, que pertence à escola anterior. */
  definir(parcial: Partial<FiltrosGlobais>): Promise<boolean> {
    const proximo = { ...this._filtros(), ...parcial };
    if (
      'escolaId' in parcial &&
      parcial.escolaId !== this._filtros().escolaId &&
      !('turmaId' in parcial)
    ) {
      proximo.turmaId = null;
    }
    this._filtros.set(proximo);
    return this.router.navigate([], { queryParams: proximo, queryParamsHandling: 'merge' });
  }

  limpar(): Promise<boolean> {
    return this.definir(VAZIO);
  }

  private lerDaUrl(url: string): void {
    const consulta = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0] : '';
    const lidos = filtrosDaUrl(new URLSearchParams(consulta));
    const atuais = this._filtros();
    if (
      lidos.anoLetivo !== atuais.anoLetivo ||
      lidos.escolaId !== atuais.escolaId ||
      lidos.anoEscolar !== atuais.anoEscolar ||
      lidos.turmaId !== atuais.turmaId
    ) {
      this._filtros.set(lidos);
    }
  }
}
