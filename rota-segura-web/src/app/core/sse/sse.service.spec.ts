import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../auth/auth.service';
import { FETCH, LIMITE_SEM_EVENTO_MS, SseService } from './sse.service';

/** Stream falso controlado pelo teste: `enviar` empurra texto, `fechar` encerra a conexão. */
function streamFalso() {
  let controle!: ReadableStreamDefaultController<Uint8Array>;
  const corpo = new ReadableStream<Uint8Array>({ start: (c) => (controle = c) });
  const codificador = new TextEncoder();
  return {
    resposta: { ok: true, status: 200, body: corpo } as unknown as Response,
    enviar: (texto: string) => controle.enqueue(codificador.encode(texto)),
    fechar: () => controle.close(),
  };
}

describe('SseService', () => {
  let fetchFalso: ReturnType<typeof vi.fn>;
  let servico: SseService;
  const auth = { token: () => 'token-de-teste', renovar: vi.fn(() => of(true)) };

  beforeEach(() => {
    vi.useFakeTimers();
    fetchFalso = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: FETCH, useValue: fetchFalso },
        { provide: AuthService, useValue: auth },
      ],
    });
    servico = TestBed.inject(SseService);
  });

  afterEach(() => {
    servico.desconectar();
    vi.useRealTimers();
  });

  it('conecta com o token no cabeçalho (nunca na URL) e entrega os eventos por tipo', async () => {
    const stream = streamFalso();
    fetchFalso.mockResolvedValue(stream.resposta);
    const recebidos: unknown[] = [];
    servico
      .de<{ alunoId: number }>('jornada.atualizada')
      .subscribe((dados) => recebidos.push(dados));

    servico.conectar();
    await vi.advanceTimersByTimeAsync(0);

    const [url, opcoes] = fetchFalso.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/stream');
    expect((opcoes.headers as Record<string, string>)['Authorization']).toBe(
      'Bearer token-de-teste',
    );
    expect(servico.estado()).toBe('online');

    stream.enviar('event: jornada.atualizada\nid: 5\ndata: {"alunoId":42}\n\n');
    stream.enviar('event: heartbeat\ndata: {}\n\n');
    await vi.advanceTimersByTimeAsync(0);

    expect(recebidos).toEqual([{ alunoId: 42 }]);
    expect(servico.atrasadoHaMin()).toBeNull();
  });

  it('reconecta com espera crescente e reenvia o Last-Event-ID', async () => {
    const primeiro = streamFalso();
    const segundo = streamFalso();
    fetchFalso.mockResolvedValueOnce(primeiro.resposta).mockResolvedValueOnce(segundo.resposta);

    servico.conectar();
    await vi.advanceTimersByTimeAsync(0);
    primeiro.enviar('event: alerta.criado\nid: 9\ndata: {}\n\n');
    await vi.advanceTimersByTimeAsync(0);
    primeiro.fechar();
    await vi.advanceTimersByTimeAsync(0);

    expect(servico.estado()).toBe('reconectando');
    expect(fetchFalso).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(fetchFalso).toHaveBeenCalledTimes(2);
    const opcoes = fetchFalso.mock.calls[1][1] as RequestInit;
    expect((opcoes.headers as Record<string, string>)['Last-Event-ID']).toBe('9');
    expect(servico.estado()).toBe('online');
  });

  it('continua tentando quando o servidor está fora, sem passar de 30 s entre tentativas', async () => {
    fetchFalso.mockRejectedValue(new Error('rede'));

    servico.conectar();
    await vi.advanceTimersByTimeAsync(0);
    expect(servico.estado()).toBe('reconectando');

    await vi.advanceTimersByTimeAsync(1_000 + 2_000 + 4_000);
    expect(fetchFalso).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(8_000 + 16_000 + 30_000 + 30_000);
    expect(fetchFalso).toHaveBeenCalledTimes(8);
  });

  it('avisa que os dados estão atrasados quando o servidor para de mandar eventos', async () => {
    const stream = streamFalso();
    fetchFalso.mockResolvedValueOnce(stream.resposta).mockRejectedValue(new Error('rede'));

    servico.conectar();
    await vi.advanceTimersByTimeAsync(0);
    expect(servico.atrasadoHaMin()).toBeNull();

    await vi.advanceTimersByTimeAsync(LIMITE_SEM_EVENTO_MS + 10_000);

    expect(servico.atrasadoHaMin()).toBe(1);
    expect(servico.estado()).toBe('reconectando');

    await vi.advanceTimersByTimeAsync(180_000);
    expect(servico.atrasadoHaMin()).toBeGreaterThanOrEqual(3);
  });

  it('renova a sessão quando o stream responde 401', async () => {
    fetchFalso.mockResolvedValue({ ok: false, status: 401, body: null } as unknown as Response);

    servico.conectar();
    await vi.advanceTimersByTimeAsync(0);

    expect(auth.renovar).toHaveBeenCalled();
    expect(servico.estado()).toBe('reconectando');
  });

  it('desconectar para tudo', async () => {
    fetchFalso.mockRejectedValue(new Error('rede'));
    servico.conectar();
    await vi.advanceTimersByTimeAsync(0);

    servico.desconectar();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(fetchFalso).toHaveBeenCalledTimes(1);
    expect(servico.estado()).toBe('desconectado');
  });
});
