import { ChangeDetectionStrategy, Component, input, linkedSignal, output } from '@angular/core';
import { Icone } from '../../shared/ui/icone';
import { ANO_MINIMO, soDigitos, validarAno } from './calendario.logica';

/**
 * Ano letivo digitável. Só aceita números; a escolha vale no Enter, ao sair do campo ou nas setas, para
 * não consultar o backend a cada tecla. A linha da mensagem tem altura reservada: nada muda de lugar.
 */
@Component({
  selector: 'rs-campo-ano',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="caixa" [class.caixa--erro]="erro()">
      <button
        type="button"
        aria-label="Ano anterior"
        [disabled]="ano() <= minimo"
        (click)="anoEscolhido.emit(ano() - 1)"
      >
        <rs-icone nome="esq" [tamanho]="16" />
      </button>
      <input
        #campo
        type="text"
        inputmode="numeric"
        autocomplete="off"
        maxlength="4"
        placeholder="Ano"
        aria-label="Ano letivo (digite e pressione Enter)"
        [attr.aria-invalid]="erro() !== ''"
        [value]="texto()"
        (focus)="campo.select()"
        (input)="digitar(campo)"
        (keydown.enter)="confirmar(campo)"
        (blur)="confirmar(campo)"
      />
      <button
        type="button"
        aria-label="Próximo ano"
        [disabled]="ano() >= anoAtual()"
        (click)="anoEscolhido.emit(ano() + 1)"
      >
        <rs-icone nome="dir" [tamanho]="16" />
      </button>
    </div>
    <p class="mensagem" role="alert">{{ erro() }}</p>
  `,
  styles: `
    /* A mensagem fica numa faixa reservada e fora do fluxo: não empurra nada para o lado nem para baixo. */
    :host {
      display: block;
      position: relative;
      padding-bottom: 20px;
    }
    .caixa {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 3px;
      border: 1px solid var(--borda-forte);
      border-radius: var(--raio);
      background: var(--superficie-sutil);
    }
    .caixa:focus-within {
      border-color: var(--foco);
    }
    .caixa--erro,
    .caixa--erro:focus-within {
      border-color: var(--critico);
    }
    button {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: var(--raio-sm);
      background: transparent;
      cursor: pointer;
    }
    button:disabled {
      opacity: 0.35;
      cursor: default;
    }
    input {
      width: 72px;
      height: 32px;
      border: 0;
      border-radius: var(--raio-sm);
      background: var(--superficie-2);
      font-family: var(--fonte-mono);
      font-size: 15px;
      font-weight: 700;
      text-align: center;
    }
    .caixa--erro input:focus-visible {
      outline-color: var(--critico);
    }
    .mensagem {
      position: absolute;
      bottom: 0;
      left: 0;
      width: max-content;
      max-width: 340px;
      margin: 0;
      color: var(--critico);
      font-size: 12px;
      line-height: 18px;
    }
    /* Em tela estreita a mensagem pode ocupar duas linhas. */
    @media (max-width: 600px) {
      :host {
        padding-bottom: 38px;
      }
      .mensagem {
        max-width: calc(100vw - 150px);
      }
    }
  `,
})
export class CampoAno {
  readonly ano = input.required<number>();
  readonly anoAtual = input.required<number>();
  readonly anoEscolhido = output<number>();

  protected readonly minimo = ANO_MINIMO;
  /** Voltam ao normal sempre que o ano aberto muda. */
  protected readonly texto = linkedSignal(() => String(this.ano()));
  protected readonly erro = linkedSignal({ source: this.ano, computation: () => '' });

  protected digitar(campo: HTMLInputElement): void {
    const limpo = soDigitos(campo.value);
    // Escreve direto no elemento: se o texto limpo for igual ao anterior, o binding não redesenha.
    campo.value = limpo;
    this.texto.set(limpo);
    this.erro.set('');
  }

  protected confirmar(campo: HTMLInputElement): void {
    if (this.texto() === '') {
      const aberto = String(this.ano());
      campo.value = aberto;
      this.texto.set(aberto);
      this.erro.set('');
      return;
    }
    const resultado = validarAno(this.texto(), this.anoAtual());
    if ('erro' in resultado) {
      this.erro.set(resultado.erro);
    } else if (resultado.ano !== this.ano()) {
      this.erro.set('');
      this.anoEscolhido.emit(resultado.ano);
    }
  }
}
