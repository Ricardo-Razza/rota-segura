import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { mensagemDeErro } from '../../core/auth/erro.interceptor';

@Component({
  selector: 'rs-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="pagina">
      <form class="cartao" (submit)="entrar($event, login.value, senha.value)" novalidate>
        <div class="rs-marca marca">
          <img src="logo.svg" alt="" width="64" height="51" />
          <span><span class="rs-marca__rota">Rota </span><span class="rs-marca__segura">Segura</span></span>
        </div>
        <p class="subtitulo">Gestão escolar · jornada do aluno</p>
        <h1>Entrar no painel</h1>

        <label for="login">Login</label>
        <input #login id="login" class="rs-campo" type="text" autocomplete="username" required maxlength="120" />

        <label for="senha">Senha</label>
        <input #senha id="senha" class="rs-campo" type="password" autocomplete="current-password" required maxlength="200" />

        @if (erro()) {
          <p class="erro" role="alert">{{ erro() }}</p>
        }

        <button type="submit" class="rs-botao rs-botao--primario" [disabled]="enviando()">
          {{ enviando() ? 'Entrando…' : 'Entrar' }}
        </button>
      </form>
    </main>
  `,
  styles: `
    .pagina {
      display: grid;
      place-items: center;
      min-height: 100vh;
      padding: 16px;
      /* Halo discreto nas cores da marca, sem competir com o formulário. */
      background:
        radial-gradient(60rem 30rem at 15% -10%, color-mix(in srgb, var(--marca) 12%, transparent), transparent 70%),
        radial-gradient(50rem 30rem at 110% 110%, color-mix(in srgb, var(--marca-secundaria) 12%, transparent), transparent 70%),
        var(--fundo);
    }
    .cartao {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(380px, 100%);
      padding: 32px 28px 28px;
      border: 1px solid var(--borda);
      border-radius: 18px;
      background: var(--superficie);
      box-shadow: var(--sombra-media);
    }
    .marca {
      align-self: center;
      flex-direction: column;
      gap: 8px;
      font-size: 26px;
    }
    .marca img {
      width: 88px;
    }
    .subtitulo {
      margin: 0;
      align-self: center;
      color: var(--texto-mudo);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
    h1 {
      margin: 18px 0 6px;
      font-size: 18px;
    }
    label {
      margin-top: 6px;
      color: var(--texto-suave);
      font-size: 12px;
    }
    button {
      justify-content: center;
      margin-top: 14px;
    }
    .erro {
      margin: 6px 0 0;
      color: var(--critico);
    }
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly erro = signal('');
  protected readonly enviando = signal(false);

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
        this.erro.set(falha instanceof HttpErrorResponse ? mensagemDeErro(falha) : 'Não foi possível entrar.');
      },
    });
  }
}
