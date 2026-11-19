import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Ícones de linha (viewBox 24, traço 2, pontas arredondadas). Os traços ficam aqui em vez de
 * vir de uma biblioteca: são poucos, não pesam no pacote e herdam a cor do texto (currentColor).
 */
export const ICONES = {
  agora: ['M3 10.5 12 3l9 7.5', 'M5 9v12h14V9'],
  escola: ['M3 21h18', 'M5 21V9l7-5 7 5v12', 'M10 21v-5h4v5'],
  onibus: ['M6 3h12a2 2 0 0 1 2 2v12H4V5a2 2 0 0 1 2-2Z', 'M4 11h16', 'M7 21v-4', 'M17 21v-4'],
  aluno: ['M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z', 'M4 21a8 8 0 0 1 16 0'],
  grafico: ['M3 3v18h18', 'm7 15 4-4 3 3 5-6'],
  documento: ['M14 3H6v18h12V7Z', 'M14 3v4h4', 'M9 13h6', 'M9 17h6'],
  sino: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'],
  busca: ['M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z', 'm20 20-3.5-3.5'],
  filtro: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  cal: ['M5 5h14a2 2 0 0 1 2 2v14H3V7a2 2 0 0 1 2-2Z', 'M3 10h18', 'M8 3v4', 'M16 3v4'],
  baixar: ['M12 4v11', 'm7 10 5 5 5-5', 'M5 20h14'],
  x: ['M6 6l12 12', 'M18 6 6 18'],
  seta: ['m6 9 6 6 6-6'],
  dir: ['m9 6 6 6-6 6'],
  esq: ['m15 6-6 6 6 6'],
  sobe: ['m6 15 6-6 6 6'],
  alerta: ['M12 3 2 20h20Z', 'M12 10v4', 'M12 17h.01'],
  check: ['m5 12 5 5 9-10'],
  sol: [
    'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
    'M12 2v2',
    'M12 20v2',
    'm4.9 4.9 1.4 1.4',
    'm17.7 17.7 1.4 1.4',
    'M2 12h2',
    'M20 12h2',
    'm4.9 19.1 1.4-1.4',
    'm17.7 6.3 1.4-1.4',
  ],
  lua: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z'],
  sair: ['M15 4h4v16h-4', 'M10 8l-4 4 4 4', 'M6 12h10'],
  tv: ['M4 5h16a1 1 0 0 1 1 1v11H3V6a1 1 0 0 1 1-1Z', 'M8 21h8', 'M12 17v4'],
  som: ['M4 9h4l5-4v14l-5-4H4Z', 'M17 9a4 4 0 0 1 0 6'],
  mudo: ['M4 9h4l5-4v14l-5-4H4Z', 'm17 9 5 5', 'm22 9-5 5'],
  menu: ['M4 7h16', 'M4 12h16', 'M4 17h16'],
  ordenar: ['m8 9 4-4 4 4', 'm8 15 4 4 4-4'],
  rosto: [
    'M4 8V5a1 1 0 0 1 1-1h3',
    'M16 4h3a1 1 0 0 1 1 1v3',
    'M20 16v3a1 1 0 0 1-1 1h-3',
    'M8 20H5a1 1 0 0 1-1-1v-3',
    'M9 10h.01',
    'M15 10h.01',
    'M9.5 15a3.5 3.5 0 0 0 5 0',
  ],
  mapa: ['m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z', 'M9 3v15', 'M15 6v15'],
  relogio: ['M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18Z', 'M12 7v5l3 2'],
  estrela: ['m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9Z'],
  olho: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z', 'M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z'],
  olhoFechado: [
    'M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2',
    'M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6',
    'M9.9 9.9a3 3 0 0 0 4.2 4.2',
    'm2 2 20 20',
  ],
  atualizar: ['M20 11a8 8 0 0 0-14.9-3', 'M4 4v4h4', 'M4 13a8 8 0 0 0 14.9 3', 'M20 20v-4h-4'],
} as const satisfies Record<string, readonly string[]>;

export type NomeIcone = keyof typeof ICONES;

/**
 * Ícone decorativo por padrão (aria-hidden). Quando o ícone for o único conteúdo de um botão,
 * dê o nome acessível no próprio botão (aria-label), não aqui.
 */
@Component({
  selector: 'rs-icone',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', class: 'rs-icone' },
  template: `
    <svg
      viewBox="0 0 24 24"
      [attr.width]="tamanho()"
      [attr.height]="tamanho()"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @for (d of tracos(); track $index) {
        <path [attr.d]="d" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
    }
  `,
})
export class Icone {
  readonly nome = input.required<NomeIcone>();
  readonly tamanho = input(18);
  protected readonly tracos = computed(() => ICONES[this.nome()]);
}
