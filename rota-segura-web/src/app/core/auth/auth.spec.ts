import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { ToastService } from '../toast/toast.service';
import { autenticadoGuard, perfilGuard } from './auth.guards';
import { authInterceptor } from './auth.interceptor';
import { RespostaToken } from './auth.models';
import { AuthService } from './auth.service';
import { erroInterceptor } from './erro.interceptor';

/** Usuário e tokens fictícios. */
function resposta(token: string, perfil: RespostaToken['usuario']['perfil'] = 'GESTAO'): RespostaToken {
  return {
    accessToken: token,
    expiraEmSegundos: 900,
    usuario: {
      id: 1,
      nome: 'Usuário Fictício',
      perfil,
      escolas: [],
      veiculos: [],
      podeRevelarContato: true,
      podeVerIndicadoresSensiveis: true,
    },
  };
}

describe('autenticação no frontend', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;
  let toasts: ToastService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([erroInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    toasts = TestBed.inject(ToastService);
    router = TestBed.inject(Router);
  });

  afterEach(() => backend.verify());

  function entrar(token = 'token-1'): void {
    auth.login('usuario.teste', 'senha-ficticia').subscribe();
    const pedido = backend.expectOne('/api/v1/auth/login');
    expect(pedido.request.withCredentials).toBe(true);
    expect(pedido.request.headers.has('Authorization')).toBe(false);
    pedido.flush(resposta(token));
  }

  it('login guarda o usuário e o token só em memória', () => {
    entrar();

    expect(auth.autenticado()).toBe(true);
    expect(auth.usuario()?.nome).toBe('Usuário Fictício');
    expect(auth.token()).toBe('token-1');
    expect(JSON.stringify({ ...localStorage })).not.toContain('token-1');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('token-1');
  });

  it('envia o Bearer nas chamadas da API e não em outras URLs', () => {
    entrar();

    http.get('/api/v1/alunos').subscribe();
    http.get('/outro-lugar/dados').subscribe();

    expect(backend.expectOne('/api/v1/alunos').request.headers.get('Authorization')).toBe('Bearer token-1');
    expect(backend.expectOne('/outro-lugar/dados').request.headers.has('Authorization')).toBe(false);
  });

  it('em 401 renova a sessão uma vez e repete a chamada com o token novo', () => {
    entrar();
    let corpo: unknown;
    http.get('/api/v1/jornadas').subscribe((dados) => (corpo = dados));

    backend.expectOne('/api/v1/jornadas').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/auth/refresh').flush(resposta('token-2'));
    const repetida = backend.expectOne('/api/v1/jornadas');
    expect(repetida.request.headers.get('Authorization')).toBe('Bearer token-2');
    repetida.flush([{ id: 1 }]);

    expect(corpo).toEqual([{ id: 1 }]);
    expect(toasts.toasts()).toEqual([]);
  });

  it('várias chamadas com 401 ao mesmo tempo usam um único refresh', () => {
    entrar();
    http.get('/api/v1/a').subscribe();
    http.get('/api/v1/b').subscribe();

    backend.expectOne('/api/v1/a').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/b').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/auth/refresh').flush(resposta('token-2'));

    backend.expectOne('/api/v1/a').flush({});
    backend.expectOne('/api/v1/b').flush({});
  });

  it('se a renovação falha, limpa a sessão e manda para o login', () => {
    entrar();
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    let falhou = false;
    http.get('/api/v1/alertas').subscribe({ error: () => (falhou = true) });

    backend.expectOne('/api/v1/alertas').flush(null, { status: 401, statusText: 'Unauthorized' });
    backend.expectOne('/api/v1/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(falhou).toBe(true);
    expect(auth.autenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/login']);
  });

  it('erro de API vira toast com o detalhe do ProblemDetail', () => {
    entrar();
    http.get('/api/v1/veiculos').subscribe({ error: () => undefined });

    backend
      .expectOne('/api/v1/veiculos')
      .flush({ title: 'Fonte de dados indisponível', detail: 'A fonte de dados está indisponível.' }, { status: 503, statusText: 'x' });

    expect(toasts.toasts().map((t) => t.mensagem)).toEqual(['A fonte de dados está indisponível.']);
    expect(toasts.toasts()[0].tom).toBe('critico');
  });

  it('falha de rede e erro sem detalhe têm mensagens próprias; login errado não gera toast', () => {
    http.get('/api/v1/x').subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/x').error(new ProgressEvent('error'));
    http.get('/api/v1/y').subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/y').flush(null, { status: 403, statusText: 'x' });
    auth.login('usuario.teste', 'errada').subscribe({ error: () => undefined });
    backend.expectOne('/api/v1/auth/login').flush({ detail: 'Login ou senha inválidos.' }, { status: 401, statusText: 'x' });

    expect(toasts.toasts().map((t) => t.mensagem)).toEqual([
      'Sem conexão com o servidor. Verifique sua rede e tente de novo.',
      'Você não tem permissão para esta operação.',
    ]);
  });

  it('sair limpa a sessão mesmo se o servidor falhar', () => {
    entrar();
    auth.sair().subscribe();
    backend.expectOne('/api/v1/auth/logout').flush(null, { status: 500, statusText: 'x' });

    expect(auth.autenticado()).toBe(false);
    expect(auth.token()).toBeNull();
  });

  it('guarda de rota restaura a sessão pelo refresh ou manda para o login', async () => {
    const semSessao = TestBed.runInInjectionContext(() => autenticadoGuard({} as never, {} as never));
    expect(isObservable(semSessao)).toBe(true);
    const pendente = firstValueFrom(semSessao as never);
    backend.expectOne('/api/v1/auth/refresh').flush(null, { status: 401, statusText: 'x' });
    expect(((await pendente) as UrlTree).toString()).toBe('/login');

    const comCookie = firstValueFrom(
      TestBed.runInInjectionContext(() => autenticadoGuard({} as never, {} as never)) as never,
    );
    backend.expectOne('/api/v1/auth/refresh').flush(resposta('token-3'));
    expect(await comCookie).toBe(true);

    expect(TestBed.runInInjectionContext(() => autenticadoGuard({} as never, {} as never))).toBe(true);
  });

  it('guarda de perfil só deixa passar os perfis autorizados', () => {
    entrar();
    const gestao = TestBed.runInInjectionContext(() => perfilGuard('GESTAO', 'SECRETARIA')({} as never, {} as never));
    const admin = TestBed.runInInjectionContext(() => perfilGuard('ADMIN')({} as never, {} as never));

    expect(gestao).toBe(true);
    expect((admin as UrlTree).toString()).toBe('/dashboard');
  });
});
