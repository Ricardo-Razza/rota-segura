import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { AlunoComSituacao, SaudeLeitor, StatusVeiculo } from '../core/api/modelos';
import { PainelApi } from '../core/api/painel-api.service';
import { rotuloVeiculo } from '../shared/formato';

export interface ResultadoBusca {
  tipo: 'Aluno' | 'Veículo' | 'Leitor';
  titulo: string;
  detalhe: string;
  caminho: string[];
  params: Record<string, string>;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').replace(/[\s-]/g, '').toLowerCase();
}

/** Veículos e leitores são filtrados aqui; alunos vão ao backend com o termo no corpo (nunca na URL). */
export function resultadosLocais(
  termo: string,
  veiculos: StatusVeiculo[],
  leitores: SaudeLeitor[],
): ResultadoBusca[] {
  const t = normalizar(termo);
  if (t.length < 2) {
    return [];
  }
  const rv: ResultadoBusca[] = veiculos
    .filter((v) => normalizar(`${v.placa ?? ''}${v.prefixo ?? ''}${v.descricao ?? ''}`).includes(t))
    .slice(0, 5)
    .map((v) => ({
      tipo: 'Veículo',
      titulo: rotuloVeiculo(v),
      detalhe: `${v.embarcados} embarcados hoje`,
      caminho: ['/veiculos'],
      params: { veiculo: String(v.id) },
    }));
  const rl: ResultadoBusca[] = leitores
    .filter((l) => normalizar(`${l.descricao ?? ''}${l.veiculoPrefixo ?? ''}${l.id}`).includes(t))
    .slice(0, 5)
    .map((l) => ({
      tipo: 'Leitor',
      titulo: l.descricao || `Leitor #${l.id}`,
      detalhe: l.tipoUsoDescricao || l.tipoUso || '',
      caminho: ['/veiculos'],
      params: {},
    }));
  return [...rv, ...rl];
}

/** Busca global (Ctrl+K): alunos, veículos e leitores. */
@Component({
  selector: 'rs-busca-global',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dialogo class="rs-dialogo busca" aria-label="Busca global" (close)="limpar()">
      <input
        #campo
        class="rs-campo"
        type="search"
        placeholder="Buscar aluno, placa ou leitor…"
        aria-label="Termo de busca"
        role="combobox"
        aria-controls="resultados-busca"
        [attr.aria-expanded]="resultados().length > 0"
        [attr.aria-activedescendant]="resultados().length ? 'res-' + ativo() : null"
        [value]="termo()"
        (input)="digitar($any($event.target).value)"
        (keydown)="teclar($event)"
      />
      <ul id="resultados-busca" role="listbox" class="resultados">
        @for (r of resultados(); track $index) {
          <li
            [id]="'res-' + $index"
            role="option"
            [attr.aria-selected]="$index === ativo()"
            [class.ativo]="$index === ativo()"
            (click)="ir(r)"
          >
            <span class="tipo">{{ r.tipo }}</span>
            <strong>{{ r.titulo }}</strong>
            <span class="rs-nota">{{ r.detalhe }}</span>
          </li>
        } @empty {
          <li class="rs-nota" role="presentation">
            {{
              termo().length < 2
                ? 'Digite ao menos 2 letras.'
                : buscando()
                  ? 'Buscando…'
                  : 'Nada encontrado.'
            }}
          </li>
        }
      </ul>
    </dialog>
  `,
  styles: `
    .busca {
      width: min(560px, calc(100vw - 32px));
      margin-top: 10vh;
    }
    input {
      width: 100%;
    }
    .resultados {
      list-style: none;
      margin: 10px 0 0;
      padding: 0;
      max-height: 50vh;
      overflow-y: auto;
    }
    li {
      display: flex;
      gap: 8px;
      align-items: baseline;
      padding: 8px;
      border-radius: 8px;
      cursor: pointer;
    }
    li.ativo {
      background: var(--info-fundo);
    }
    .tipo {
      min-width: 56px;
      color: var(--texto-suave);
      font-size: 12px;
    }
  `,
})
export class BuscaGlobal {
  private readonly api = inject(PainelApi);
  private readonly router = inject(Router);
  private readonly dialogo = viewChild.required<ElementRef<HTMLDialogElement>>('dialogo');
  private readonly campo = viewChild.required<ElementRef<HTMLInputElement>>('campo');

  protected readonly termo = signal('');
  protected readonly ativo = signal(0);
  protected readonly buscando = signal(false);
  private readonly alunos = signal<ResultadoBusca[]>([]);
  private readonly veiculos = signal<StatusVeiculo[]>([]);
  private readonly leitores = signal<SaudeLeitor[]>([]);
  private readonly digitado = new Subject<string>();

  protected readonly resultados = computed(() => [
    ...this.alunos(),
    ...resultadosLocais(this.termo(), this.veiculos(), this.leitores()),
  ]);

  constructor() {
    this.digitado
      .pipe(
        debounceTime(300),
        switchMap((termo) => {
          if (termo.trim().length < 2) {
            return of(null);
          }
          this.buscando.set(true);
          return this.api
            .buscarAlunos(termo.trim(), { tamanho: 8 })
            .pipe(catchError(() => of(null)));
        }),
        takeUntilDestroyed(),
      )
      .subscribe((lista) => {
        this.buscando.set(false);
        this.alunos.set((lista?.alunos.itens ?? []).map((a: AlunoComSituacao) => this.deAluno(a)));
      });
  }

  abrir(): void {
    const dialogo = this.dialogo().nativeElement;
    if (dialogo.open) {
      return;
    }
    dialogo.showModal();
    this.campo().nativeElement.focus();
    this.api
      .veiculos({})
      .subscribe({ next: (s) => this.veiculos.set(s.veiculos), error: () => undefined });
    this.api
      .leitores({})
      .subscribe({ next: (s) => this.leitores.set(s.leitores), error: () => undefined });
  }

  protected digitar(valor: string): void {
    this.termo.set(valor);
    this.ativo.set(0);
    this.digitado.next(valor);
  }

  protected teclar(evento: KeyboardEvent): void {
    const total = this.resultados().length;
    if (evento.key === 'ArrowDown' && total) {
      evento.preventDefault();
      this.ativo.update((i) => (i + 1) % total);
    } else if (evento.key === 'ArrowUp' && total) {
      evento.preventDefault();
      this.ativo.update((i) => (i - 1 + total) % total);
    } else if (evento.key === 'Enter' && total) {
      evento.preventDefault();
      this.ir(this.resultados()[this.ativo()]);
    }
  }

  protected ir(r: ResultadoBusca): void {
    this.dialogo().nativeElement.close();
    void this.router.navigate(r.caminho, { queryParams: r.params, queryParamsHandling: 'merge' });
  }

  protected limpar(): void {
    this.termo.set('');
    this.alunos.set([]);
  }

  private deAluno(a: AlunoComSituacao): ResultadoBusca {
    return {
      tipo: 'Aluno',
      titulo: a.aluno.nome || `Aluno #${a.aluno.id}`,
      detalhe: [a.aluno.turma, a.aluno.escolaNome].filter(Boolean).join(' · '),
      caminho: ['/alunos', String(a.aluno.id)],
      params: {},
    };
  }
}
