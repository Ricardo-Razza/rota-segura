import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface Coluna<T> {
  chave: string;
  titulo: string;
  /** Valor exibido e usado na ordenação. */
  valor: (linha: T) => string | number | null;
  alinhar?: 'esquerda' | 'direita';
  ordenavel?: boolean;
}

interface Ordenacao {
  chave: string;
  sentido: 'asc' | 'desc';
}

/** Tabela de dados com ordenação por coluna, acessível por teclado e com estado vazio. */
@Component({
  selector: 'rs-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rolagem" tabindex="0" role="region" [attr.aria-label]="legenda()">
      <table>
        <caption class="rs-somente-leitor">
          {{ legenda() }}
        </caption>
        <thead>
          <tr>
            @for (coluna of colunas(); track coluna.chave) {
              <th scope="col" [class.direita]="coluna.alinhar === 'direita'" [attr.aria-sort]="ariaSort(coluna)">
                @if (coluna.ordenavel !== false) {
                  <button type="button" (click)="ordenarPor(coluna.chave)">
                    {{ coluna.titulo }}
                    <span aria-hidden="true">{{ seta(coluna.chave) }}</span>
                  </button>
                } @else {
                  {{ coluna.titulo }}
                }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (linha of ordenadas(); track $index) {
            <tr>
              @for (coluna of colunas(); track coluna.chave) {
                <td [class.direita]="coluna.alinhar === 'direita'">{{ exibir(coluna.valor(linha)) }}</td>
              }
            </tr>
          } @empty {
            <tr>
              <td class="vazio" [attr.colspan]="colunas().length">{{ mensagemVazio() }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    .rolagem {
      overflow-x: auto;
      border: 1px solid var(--borda);
      border-radius: var(--raio);
      background: var(--superficie);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th,
    td {
      padding: 9px 12px;
      text-align: left;
      border-bottom: 1px solid var(--borda);
      white-space: nowrap;
    }
    tbody tr:last-child td {
      border-bottom: 0;
    }
    th {
      color: var(--texto-suave);
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: var(--superficie-2);
    }
    th button {
      all: unset;
      cursor: pointer;
      display: inline-flex;
      gap: 4px;
    }
    th button:focus-visible {
      outline: 2px solid var(--foco);
      outline-offset: 2px;
    }
    .direita {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    tbody tr:hover {
      background: var(--superficie-2);
    }
    .vazio {
      padding: 28px 12px;
      text-align: center;
      color: var(--texto-suave);
    }
  `,
})
export class DataTable<T> {
  readonly colunas = input.required<Coluna<T>[]>();
  readonly linhas = input.required<T[]>();
  /** Descrição da tabela para leitores de tela. */
  readonly legenda = input.required<string>();
  readonly mensagemVazio = input('Nenhum registro encontrado.');

  protected readonly ordenacao = signal<Ordenacao | null>(null);

  protected readonly ordenadas = computed(() => {
    const ordenacao = this.ordenacao();
    const coluna = ordenacao && this.colunas().find((c) => c.chave === ordenacao.chave);
    if (!ordenacao || !coluna) {
      return this.linhas();
    }
    const fator = ordenacao.sentido === 'asc' ? 1 : -1;
    return [...this.linhas()].sort((a, b) => {
      const va = coluna.valor(a);
      const vb = coluna.valor(b);
      // Sem valor vai sempre para o fim, em qualquer sentido.
      if (va === null) {
        return vb === null ? 0 : 1;
      }
      if (vb === null) {
        return -1;
      }
      if (typeof va === 'number' && typeof vb === 'number') {
        return (va - vb) * fator;
      }
      return String(va).localeCompare(String(vb), 'pt-BR', { numeric: true }) * fator;
    });
  });

  /** Números no formato pt-BR; sem valor vira travessão. */
  protected exibir(valor: string | number | null): string {
    if (valor === null) {
      return '—';
    }
    return typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor;
  }

  protected ordenarPor(chave: string): void {
    const atual = this.ordenacao();
    if (atual?.chave !== chave) {
      this.ordenacao.set({ chave, sentido: 'asc' });
    } else if (atual.sentido === 'asc') {
      this.ordenacao.set({ chave, sentido: 'desc' });
    } else {
      this.ordenacao.set(null);
    }
  }

  protected seta(chave: string): string {
    const atual = this.ordenacao();
    if (atual?.chave !== chave) {
      return '↕';
    }
    return atual.sentido === 'asc' ? '↑' : '↓';
  }

  protected ariaSort(coluna: Coluna<T>): 'ascending' | 'descending' | 'none' | null {
    if (coluna.ordenavel === false) {
      return null;
    }
    const atual = this.ordenacao();
    if (atual?.chave !== coluna.chave) {
      return 'none';
    }
    return atual.sentido === 'asc' ? 'ascending' : 'descending';
  }
}
