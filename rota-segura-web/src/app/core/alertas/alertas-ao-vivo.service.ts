import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Subscription, auditTime, merge } from 'rxjs';
import { Alerta } from '../api/modelos';
import { PainelApi } from '../api/painel-api.service';
import { SseService } from '../sse/sse.service';
import { ToastService } from '../toast/toast.service';

const CHAVE_SOM = 'rs.alertas.som';

/**
 * Alertas em tempo real para o painel todo: contador de abertos (badge do menu), toast persistente
 * a cada crítico novo e som opcional (desligado por padrão).
 */
@Injectable({ providedIn: 'root' })
export class AlertasAoVivo {
  private readonly api = inject(PainelApi);
  private readonly sse = inject(SseService);
  private readonly toasts = inject(ToastService);

  private readonly _abertos = signal<number | null>(null);
  private readonly _criticos = signal<number>(0);
  private readonly _som = signal(this.lerSom());
  private assinatura: Subscription | null = null;

  /** Alertas com status ABERTO (os em análise e resolvidos não entram). */
  readonly abertos = this._abertos.asReadonly();
  readonly criticosAbertos = this._criticos.asReadonly();
  readonly som = this._som.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.parar());
  }

  iniciar(): void {
    if (this.assinatura) {
      return;
    }
    this.atualizarResumo();
    this.assinatura = new Subscription();
    this.assinatura.add(this.sse.de<Alerta>('alerta.criado').subscribe((a) => this.aoCriar(a)));
    this.assinatura.add(
      merge(this.sse.de('alerta.criado'), this.sse.de('alerta.atualizado'))
        .pipe(auditTime(1500))
        .subscribe(() => this.atualizarResumo()),
    );
  }

  parar(): void {
    this.assinatura?.unsubscribe();
    this.assinatura = null;
  }

  atualizarResumo(): void {
    this.api.resumoAlertas().subscribe({
      next: (r) => {
        this._abertos.set(r.abertos);
        this._criticos.set(r.abertosPorSeveridade.CRITICO ?? 0);
      },
      error: () => {
        // Mantém o último número; o card de alertas mostra o erro.
      },
    });
  }

  alternarSom(): void {
    this._som.update((v) => !v);
    try {
      localStorage.setItem(CHAVE_SOM, String(this._som()));
    } catch {
      // Sem armazenamento: preferência vale só nesta sessão.
    }
  }

  private aoCriar(alerta: Alerta): void {
    if (alerta.severidade !== 'CRITICO') {
      return;
    }
    this.toasts.mostrar(`Alerta crítico: ${alerta.mensagem}`, 'critico', { persistente: true });
    if (this._som()) {
      this.tocar();
    }
  }

  private tocar(): void {
    try {
      const Contexto =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Contexto) {
        return;
      }
      const ctx = new Contexto();
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.frequency.value = 880;
      ganho.gain.value = 0.08;
      osc.connect(ganho).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      osc.onended = () => void ctx.close();
    } catch {
      // Navegador sem áudio liberado: o toast já avisou.
    }
  }

  private lerSom(): boolean {
    try {
      return localStorage.getItem(CHAVE_SOM) === 'true';
    } catch {
      return false;
    }
  }
}
