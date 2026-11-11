import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Página provisória de uma feature que ainda será implementada (título e fase vêm dos dados da rota). */
@Component({
  selector: 'rs-pagina-base',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ titulo() }}</h1>
    <p class="aviso">Esta tela será construída na {{ fase() }} do plano.</p>
  `,
  styles: `
    h1 {
      font-size: 22px;
      margin-bottom: 8px;
    }
    .aviso {
      max-width: 60ch;
      padding: 16px;
      border: 1px dashed var(--borda);
      border-radius: var(--raio);
      color: var(--texto-suave);
    }
  `,
})
export class PaginaBase {
  readonly titulo = input.required<string>();
  readonly fase = input.required<string>();
}

/** Rotas de uma feature ainda não implementada. */
export function rotasProvisorias(titulo: string, fase: string) {
  return [
    {
      path: '',
      title: `${titulo} · Rota Segura`,
      component: PaginaBase,
      data: { titulo, fase },
    },
  ];
}
