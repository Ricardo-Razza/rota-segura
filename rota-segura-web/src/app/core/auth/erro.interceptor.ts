import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../toast/toast.service';

/** Marque a requisição com este contexto quando a própria tela já mostra o erro (ex.: login, cards). */
export const SEM_TOAST_DE_ERRO = new HttpContextToken<boolean>(() => false);

/** Texto para o usuário a partir da resposta de erro (ProblemDetail do backend). */
export function mensagemDeErro(erro: HttpErrorResponse): string {
  if (erro.status === 0) {
    return 'Sem conexão com o servidor. Verifique sua rede e tente de novo.';
  }
  const detalhe = (erro.error as { detail?: unknown } | null)?.detail;
  if (typeof detalhe === 'string' && detalhe.trim()) {
    return detalhe;
  }
  switch (erro.status) {
    case 403:
      return 'Você não tem permissão para esta operação.';
    case 404:
      return 'Registro não encontrado.';
    case 429:
      return 'Muitas tentativas. Aguarde e tente de novo.';
    case 503:
      return 'A fonte de dados está indisponível no momento.';
    default:
      return 'Ocorreu um erro inesperado.';
  }
}

/** Mostra um toast para erros de API. O 401 fica com o interceptor de autenticação. */
export const erroInterceptor: HttpInterceptorFn = (req, next) => {
  const toasts = inject(ToastService);
  return next(req).pipe(
    catchError((erro: unknown) => {
      if (erro instanceof HttpErrorResponse && erro.status !== 401 && !req.context.get(SEM_TOAST_DE_ERRO)) {
        toasts.erro(mensagemDeErro(erro));
      }
      return throwError(() => erro);
    }),
  );
};
