import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensagemDeErro } from '../../core/auth/erro.interceptor';
import { Icone } from '../../shared/ui/icone';

@Component({
  selector: 'rs-login',
  imports: [Icone],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pagina">
      <section class="lado">
        <div class="rs-marca marca">
          <img src="logo.svg" alt="" width="56" height="45" />
          <span
            ><span class="rs-marca__rota">Rota </span
            ><span class="rs-marca__segura">Segura</span></span
          >
        </div>
        <h1>Cada aluno, do ônibus à <span class="destaque">sala de aula</span>.</h1>
        <p class="subtitulo">Painel da Secretaria de Educação</p>

        <form
          class="cartao rs-vidro"
          (submit)="entrar($event, login.value, senha.value)"
          novalidate
        >
          <label for="login">Login</label>
          <input
            #login
            id="login"
            class="rs-campo"
            type="text"
            autocomplete="username"
            required
            maxlength="120"
          />

          <label for="senha">Senha</label>
          <div class="senha">
            <input
              #senha
              id="senha"
              class="rs-campo"
              [type]="mostrarSenha() ? 'text' : 'password'"
              autocomplete="current-password"
              required
              maxlength="200"
            />
            <button
              type="button"
              class="olho"
              (click)="mostrarSenha.set(!mostrarSenha())"
              [attr.aria-pressed]="mostrarSenha()"
              [attr.aria-label]="
                mostrarSenha() ? 'Esconder o que foi digitado' : 'Mostrar o que foi digitado'
              "
            >
              <rs-icone [nome]="mostrarSenha() ? 'olhoFechado' : 'olho'" [tamanho]="18" />
            </button>
          </div>

          @if (erro()) {
            <p class="erro" role="alert">{{ erro() }}</p>
          }

          <button type="submit" class="rs-botao rs-botao--primario entrar" [disabled]="enviando()">
            {{ enviando() ? 'Entrando…' : 'Entrar' }}
          </button>
          <p class="rodape">Acesso restrito · tentativas limitadas por segurança</p>
        </form>
      </section>

      <svg class="ilustracao" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
        <g class="ruas">
          <path d="M0 120 Q300 100 600 140" />
          <path d="M0 330 Q300 310 600 330" />
          <path d="M0 520 Q300 500 600 510" />
          <path d="M150 0 Q160 300 140 600" />
          <path d="M440 0 Q460 300 450 600" />
        </g>
        <path class="rota rota--verde" d="M60 560 Q200 400 320 330 T560 160" />
        <path class="rota rota--azul" d="M440 360 Q520 420 600 450" />
        <circle class="parada" cx="320" cy="330" r="10" />
        <circle class="parada parada--azul" cx="440" cy="360" r="10" />
        <rect class="escola" x="546" y="146" width="28" height="28" rx="7" />
      </svg>
    </main>
  `,
  styles: `
    .pagina {
      display: grid;
      grid-template-columns: minmax(0, 520px) 1fr;
      align-items: center;
      gap: 40px;
      min-height: 100vh;
      min-height: 100dvh;
      padding: 32px clamp(16px, 8vw, 120px);
    }
    .lado {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .marca {
      font-size: 28px;
    }
    .marca img {
      width: 56px;
    }
    h1 {
      margin-top: 28px;
      font-size: clamp(32px, 4.4vw, 46px);
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.03em;
    }
    .destaque {
      color: var(--marca);
    }
    .subtitulo {
      margin: 0 0 18px;
      color: var(--texto-suave);
    }
    .cartao {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 26px 28px 20px;
      border-radius: 24px;
    }
    label {
      margin-top: 4px;
      color: var(--texto-suave);
      font-size: 13px;
      font-weight: 700;
    }
    .rs-campo {
      width: 100%;
      min-height: 46px;
      border-radius: 12px;
      background: var(--fundo);
    }
    .senha {
      position: relative;
    }
    .senha .rs-campo {
      padding-right: 48px;
    }
    .olho {
      position: absolute;
      top: 3px;
      right: 3px;
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: 0;
      border-radius: 10px;
      background: none;
      color: var(--texto-mudo);
      cursor: pointer;
    }
    .olho:hover {
      color: var(--texto);
    }
    .entrar {
      justify-content: center;
      min-height: 48px;
      margin-top: 14px;
      border-radius: 12px;
      font-size: 15px;
    }
    .rodape {
      margin: 6px 0 0;
      color: var(--texto-mudo);
      font-size: 12px;
      text-align: center;
    }
    .erro {
      margin: 6px 0 0;
      color: var(--critico);
    }
    .ilustracao {
      width: 100%;
      max-height: 80vh;
    }
    .ruas path {
      fill: none;
      stroke: var(--borda-forte);
      stroke-width: 1.5;
      opacity: 0.6;
    }
    .rota {
      fill: none;
      stroke-width: 4;
      stroke-linecap: round;
    }
    .rota--verde {
      stroke: var(--sucesso);
      filter: drop-shadow(0 0 8px color-mix(in srgb, var(--sucesso) 60%, transparent));
    }
    .rota--azul {
      stroke: var(--info);
    }
    .parada {
      fill: var(--sucesso);
      stroke: var(--texto);
      stroke-width: 3;
    }
    .parada--azul {
      fill: var(--info);
    }
    .escola {
      fill: var(--sucesso);
    }
    @media (max-width: 860px) {
      .pagina {
        grid-template-columns: 1fr;
        padding: 24px 16px;
      }
      .ilustracao {
        display: none;
      }
      h1 {
        margin-top: 16px;
      }
    }
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly erro = signal('');
  protected readonly enviando = signal(false);
  protected readonly mostrarSenha = signal(false);

  protected entrar(evento: Event, login: string, senha: string): void {
    evento.preventDefault();
    if (!login.trim() || !senha) {
      this.erro.set('Informe o login e a senha.');
      return;
    }
    this.erro.set('');
    this.enviando.set(true);
    this.auth.login(login.trim(), senha).subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: (falha: unknown) => {
        this.enviando.set(false);
        this.erro.set(
          falha instanceof HttpErrorResponse ? mensagemDeErro(falha) : 'Não foi possível entrar.',
        );
      },
    });
  }
}
