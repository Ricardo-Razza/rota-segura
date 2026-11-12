import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';
import { API } from '../auth/auth.models';
import { AuthService } from '../auth/auth.service';
import { EventoSse, ParserSse } from './parser-sse';

export type EstadoConexao = 'desconectado' | 'online' | 'reconectando';

/** fetch injetável, para os testes simularem o stream. */
export const FETCH = new InjectionToken<typeof fetch>('fetch', {
  providedIn: 'root',
  factory: () => (entrada, opcoes) => fetch(entrada, opcoes),
});

/** O servidor manda heartbeat a cada 15 s; sem nada por este tempo, os dados são tratados como atrasados. */
export const LIMITE_SEM_EVENTO_MS = 45_000;
const ESPERA_INICIAL_MS = 1_000;
const ESPERA_MAXIMA_MS = 30_000;

/**
 * Tempo real do painel por Server-Sent Events. Usa fetch em stream (e não EventSource) para
 * poder enviar o token no cabeçalho Authorization, nunca na URL. Reconecta sozinho com espera
 * crescente e reenvia o Last-Event-ID para o servidor repor o que foi perdido.
 */
@Injectable({ providedIn: 'root' })
export class SseService {
  private readonly auth = inject(AuthService);
  private readonly fetchFn = inject(FETCH);
  private readonly eventos = new Subject<EventoSse>();

  private readonly _estado = signal<EstadoConexao>('desconectado');
  private readonly _ultimoEventoEm = signal<number | null>(null);
  private readonly agora = signal(Date.now());

  private cancelamento: AbortController | null = null;
  private relogio: ReturnType<typeof setInterval> | null = null;
  private reconexao: ReturnType<typeof setTimeout> | null = null;
  private ultimoId: string | null = null;
  private tentativas = 0;
  private ativo = false;

  readonly estado = this._estado.asReadonly();
  readonly ultimoEventoEm = this._ultimoEventoEm.asReadonly();
  /** Minutos sem receber nada do servidor, ou null se os dados estão em dia. */
  readonly atrasadoHaMin = computed(() => {
    const ultimo = this._ultimoEventoEm();
    if (ultimo === null) {
      return null;
    }
    const semEvento = this.agora() - ultimo;
    return semEvento > LIMITE_SEM_EVENTO_MS ? Math.max(1, Math.floor(semEvento / 60_000)) : null;
  });

  /** Eventos de um tipo (ex.: "jornada.atualizada"), já com o JSON convertido. */
  de<T>(tipo: string): Observable<T> {
    return this.eventos.pipe(
      filter((evento) => evento.tipo === tipo),
      map((evento) => JSON.parse(evento.dados) as T),
    );
  }

  conectar(): void {
    if (this.ativo) {
      return;
    }
    this.ativo = true;
    this.relogio = setInterval(() => this.verificarAtraso(), 5_000);
    void this.abrir();
  }

  desconectar(): void {
    this.ativo = false;
    this.cancelamento?.abort();
    this.cancelamento = null;
    if (this.relogio) {
      clearInterval(this.relogio);
    }
    if (this.reconexao) {
      clearTimeout(this.reconexao);
    }
    this.relogio = this.reconexao = null;
    this.tentativas = 0;
    this._estado.set('desconectado');
  }

  private async abrir(): Promise<void> {
    const cancelamento = new AbortController();
    this.cancelamento = cancelamento;
    try {
      const cabecalhos: Record<string, string> = { Accept: 'text/event-stream' };
      const token = this.auth.token();
      if (token) {
        cabecalhos['Authorization'] = `Bearer ${token}`;
      }
      if (this.ultimoId) {
        cabecalhos['Last-Event-ID'] = this.ultimoId;
      }
      const resposta = await this.fetchFn(`${API}/stream`, {
        headers: cabecalhos,
        signal: cancelamento.signal,
        cache: 'no-store',
      });
      if (resposta.status === 401) {
        // Token vencido: renova a sessão e tenta de novo no próximo ciclo.
        await new Promise<void>((pronto) => this.auth.renovar().subscribe(() => pronto()));
        throw new Error('nao-autenticado');
      }
      if (!resposta.ok || !resposta.body) {
        throw new Error(`stream indisponível (${resposta.status})`);
      }
      this._estado.set('online');
      this.tentativas = 0;
      this.marcarRecebimento();
      await this.ler(resposta.body);
      throw new Error('stream encerrado pelo servidor');
    } catch {
      if (this.ativo && this.cancelamento === cancelamento) {
        this.agendarReconexao();
      }
    }
  }

  private async ler(corpo: ReadableStream<Uint8Array>): Promise<void> {
    const leitor = corpo.getReader();
    const decodificador = new TextDecoder();
    const parser = new ParserSse();
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) {
        return;
      }
      this.marcarRecebimento();
      for (const evento of parser.alimentar(decodificador.decode(value, { stream: true }))) {
        if (evento.id !== null) {
          this.ultimoId = evento.id;
        }
        if (evento.tipo !== 'heartbeat') {
          this.eventos.next(evento);
        }
      }
    }
  }

  private marcarRecebimento(): void {
    const agora = Date.now();
    this._ultimoEventoEm.set(agora);
    this.agora.set(agora);
  }

  private verificarAtraso(): void {
    this.agora.set(Date.now());
    const ultimo = this._ultimoEventoEm();
    // Conexão "aberta" mas muda: derruba e reconecta em vez de fingir que está ao vivo.
    if (
      this._estado() === 'online' &&
      ultimo !== null &&
      Date.now() - ultimo > LIMITE_SEM_EVENTO_MS
    ) {
      this.cancelamento?.abort();
      this.agendarReconexao();
    }
  }

  private agendarReconexao(): void {
    if (!this.ativo || this.reconexao) {
      return;
    }
    this._estado.set('reconectando');
    const espera = Math.min(ESPERA_MAXIMA_MS, ESPERA_INICIAL_MS * 2 ** this.tentativas);
    this.tentativas++;
    this.reconexao = setTimeout(() => {
      this.reconexao = null;
      if (this.ativo) {
        void this.abrir();
      }
    }, espera);
  }
}
