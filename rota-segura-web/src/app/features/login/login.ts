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
        <div class="marca"><span class="logo" aria-hidden="true">RS</span> Rota Segura</div>
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
    }
    .cartao {
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: min(360px, 100%);
      padding: 28px;
      border: 1px solid var(--borda);
      border-radius: 14px;
      background: var(--superficie);
      box-shadow: var(--sombra);
    }
    .marca {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 700;
    }
    .logo {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: var(--info);
      color: #fff;
      font-size: 13px;
    }
    h1 {
      margin: 12px 0 8px;
      font-size: 20px;
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
