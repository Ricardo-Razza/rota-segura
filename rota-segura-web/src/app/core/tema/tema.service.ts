import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';

export type Tema = 'escuro' | 'claro';

const CHAVE = 'rs.tema';

/** Tema escuro por padrão; a escolha do usuário fica guardada no navegador. */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly documento = inject(DOCUMENT);
  private readonly _tema = signal<Tema>(this.lerPreferencia());
  readonly tema = this._tema.asReadonly();

  constructor() {
    this.aplicar(this._tema());
  }

  alternar(): void {
    this.definir(this._tema() === 'escuro' ? 'claro' : 'escuro');
  }

  definir(tema: Tema): void {
    this._tema.set(tema);
    this.aplicar(tema);
    try {
      localStorage.setItem(CHAVE, tema);
    } catch {
      // Navegador sem armazenamento: o tema vale só para esta sessão.
    }
  }

  private aplicar(tema: Tema): void {
    this.documento.documentElement.setAttribute('data-tema', tema);
  }

  private lerPreferencia(): Tema {
    try {
      return localStorage.getItem(CHAVE) === 'claro' ? 'claro' : 'escuro';
    } catch {
      return 'escuro';
    }
  }
}
