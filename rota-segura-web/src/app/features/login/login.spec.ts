import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth/auth.service';
import { Login } from './login';

describe('Login', () => {
  const auth = { login: vi.fn() };
  const router = { navigate: vi.fn(() => Promise.resolve(true)) };

  function montar() {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const enviar = (login: string, senha: string) => {
      el.querySelector<HTMLInputElement>('#login')!.value = login;
      el.querySelector<HTMLInputElement>('#senha')!.value = senha;
      el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
      fixture.detectChanges();
    };
    return { el, enviar };
  }

  beforeEach(() => vi.clearAllMocks());

  it('entra e vai para o dashboard', () => {
    auth.login.mockReturnValue(of({ id: 1 }));
    const { enviar } = montar();

    enviar(' usuario.teste ', 'senha-ficticia');

    expect(auth.login).toHaveBeenCalledWith('usuario.teste', 'senha-ficticia');
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('mostra a mensagem do servidor quando o login falha e libera o botão', () => {
    auth.login.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 401, error: { detail: 'Login ou senha inválidos.' } })),
    );
    const { el, enviar } = montar();

    enviar('usuario.teste', 'errada');

    expect(el.querySelector('[role="alert"]')?.textContent).toBe('Login ou senha inválidos.');
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('campos vazios nem chegam ao servidor', () => {
    const { el, enviar } = montar();

    enviar('', '');

    expect(auth.login).not.toHaveBeenCalled();
    expect(el.querySelector('[role="alert"]')?.textContent).toBe('Informe o login e a senha.');
  });

  it('os campos têm rótulo e autocomplete corretos', () => {
    const { el } = montar();

    expect(el.querySelector('label[for="login"]')).not.toBeNull();
    expect(el.querySelector('#senha')?.getAttribute('type')).toBe('password');
    expect(el.querySelector('#senha')?.getAttribute('autocomplete')).toBe('current-password');
  });
});
