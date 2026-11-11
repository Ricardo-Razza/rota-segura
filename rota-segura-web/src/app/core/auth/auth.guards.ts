import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { Perfil } from './auth.models';
import { AuthService } from './auth.service';

/** Exige sessão. Ao recarregar a página, tenta restaurá-la pelo cookie de refresh antes de mandar ao login. */
export const autenticadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.autenticado()) {
    return true;
  }
  return auth.renovar().pipe(map((ok) => (ok ? true : router.createUrlTree(['/login']))));
};

/** Restringe a rota a alguns perfis; os demais voltam ao dashboard. */
export function perfilGuard(...perfis: Perfil[]): CanActivateFn {
  return () => {
    const usuario = inject(AuthService).usuario();
    return usuario && perfis.includes(usuario.perfil) ? true : inject(Router).createUrlTree(['/dashboard']);
  };
}
