import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { API } from './auth.models';
import { AuthService } from './auth.service';

const SEM_TOKEN = [`${API}/auth/login`, `${API}/auth/refresh`, `${API}/auth/logout`];

function comToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * Envia o token de acesso nas chamadas à API do painel. Ao receber 401, renova a sessão
 * uma única vez e repete a chamada; se a renovação falhar, manda para o login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(API) || SEM_TOKEN.some((rota) => req.url.startsWith(rota))) {
    return next(req);
  }
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(comToken(req, auth.token())).pipe(
    catchError((erro: unknown) => {
      if (!(erro instanceof HttpErrorResponse) || erro.status !== 401) {
        return throwError(() => erro);
      }
      return auth.renovar().pipe(
        switchMap((renovou) => {
          if (renovou) {
            return next(comToken(req, auth.token()));
          }
          void router.navigate(['/login']);
          return throwError(() => erro);
        }),
      );
    }),
  );
};
