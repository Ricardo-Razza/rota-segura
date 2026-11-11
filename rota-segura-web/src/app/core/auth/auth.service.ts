import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { API, RespostaToken, Usuario } from './auth.models';
import { SEM_TOAST_DE_ERRO } from './erro.interceptor';

/** Login e refresh mostram o próprio erro (ou nenhum): sem toast automático. */
const SILENCIOSO = { withCredentials: true, context: new HttpContext().set(SEM_TOAST_DE_ERRO, true) };

/**
 * Sessão do painel. O token de acesso fica só em memória (nunca em localStorage);
 * o refresh token vive num cookie httpOnly que o JavaScript não enxerga.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly _usuario = signal<Usuario | null>(null);
  private readonly _token = signal<string | null>(null);
  private renovacaoEmCurso: Observable<boolean> | null = null;

  readonly usuario = this._usuario.asReadonly();
  readonly autenticado = computed(() => this._usuario() !== null);

  token(): string | null {
    return this._token();
  }

  login(login: string, senha: string): Observable<Usuario> {
    return this.http
      .post<RespostaToken>(`${API}/auth/login`, { login, senha }, SILENCIOSO)
      .pipe(map((resposta) => this.guardar(resposta)));
  }

  /**
   * Troca o cookie de refresh por um novo token de acesso. Chamadas simultâneas
   * compartilham a mesma requisição: o refresh é rotativo e só pode ser usado uma vez.
   */
  renovar(): Observable<boolean> {
    if (!this.renovacaoEmCurso) {
      this.renovacaoEmCurso = this.http
        .post<RespostaToken>(`${API}/auth/refresh`, null, SILENCIOSO)
        .pipe(
          map((resposta) => {
            this.guardar(resposta);
            return true;
          }),
          catchError(() => {
            this.limpar();
            return of(false);
          }),
          finalize(() => (this.renovacaoEmCurso = null)),
          shareReplay(1),
        );
    }
    return this.renovacaoEmCurso;
  }

  sair(): Observable<void> {
    return this.http.post<void>(`${API}/auth/logout`, null, { withCredentials: true }).pipe(
      catchError(() => of(undefined)),
      tap(() => this.limpar()),
    );
  }

  limpar(): void {
    this._usuario.set(null);
    this._token.set(null);
  }

  private guardar(resposta: RespostaToken): Usuario {
    this._token.set(resposta.accessToken);
    this._usuario.set(resposta.usuario);
    return resposta.usuario;
  }
}
