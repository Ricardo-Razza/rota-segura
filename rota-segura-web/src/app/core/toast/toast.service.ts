import { Injectable, signal } from '@angular/core';

export type TomToast = 'info' | 'sucesso' | 'atencao' | 'critico';

export interface Toast {
  id: number;
  tom: TomToast;
  mensagem: string;
  /** Persistente só some quando o usuário fecha (ex.: alerta crítico). */
  persistente: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private proximoId = 1;
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  mostrar(mensagem: string, tom: TomToast = 'info', opcoes: { persistente?: boolean; duracaoMs?: number } = {}): number {
    const id = this.proximoId++;
    const persistente = opcoes.persistente ?? false;
    // Mensagem repetida não empilha: evita uma parede de toasts quando várias chamadas falham juntas.
    if (this._toasts().some((t) => t.mensagem === mensagem && t.tom === tom)) {
      return id;
    }
    this._toasts.update((lista) => [...lista, { id, tom, mensagem, persistente }]);
    if (!persistente) {
      setTimeout(() => this.fechar(id), opcoes.duracaoMs ?? 6000);
    }
    return id;
  }

  erro(mensagem: string): number {
    return this.mostrar(mensagem, 'critico');
  }

  fechar(id: number): void {
    this._toasts.update((lista) => lista.filter((t) => t.id !== id));
  }
}
