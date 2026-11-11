/** Evento do stream do painel (formato text/event-stream). */
export interface EventoSse {
  tipo: string;
  dados: string;
  id: string | null;
}

/**
 * Parser incremental de Server-Sent Events. Recebe pedaços de texto na ordem em que chegam
 * da rede (um evento pode vir partido em vários) e devolve os eventos completos.
 */
export class ParserSse {
  private resto = '';
  private tipo = 'message';
  private dados: string[] = [];
  private id: string | null = null;

  alimentar(pedaco: string): EventoSse[] {
    this.resto += pedaco;
    const eventos: EventoSse[] = [];
    let quebra: number;
    while ((quebra = this.resto.search(/\r\n|\n|\r/)) >= 0) {
      const linha = this.resto.slice(0, quebra);
      const tamanhoDaQuebra = this.resto.startsWith('\r\n', quebra) ? 2 : 1;
      // Um "\r" no fim do pedaço pode ser metade de um "\r\n": espera o próximo pedaço.
      if (tamanhoDaQuebra === 1 && this.resto[quebra] === '\r' && quebra === this.resto.length - 1) {
        break;
      }
      this.resto = this.resto.slice(quebra + tamanhoDaQuebra);
      const evento = this.processarLinha(linha);
      if (evento) {
        eventos.push(evento);
      }
    }
    return eventos;
  }

  private processarLinha(linha: string): EventoSse | null {
    if (linha === '') {
      const evento = this.dados.length ? { tipo: this.tipo, dados: this.dados.join('\n'), id: this.id } : null;
      this.tipo = 'message';
      this.dados = [];
      return evento;
    }
    if (linha.startsWith(':')) {
      return null; // comentário
    }
    const separador = linha.indexOf(':');
    const campo = separador < 0 ? linha : linha.slice(0, separador);
    let valor = separador < 0 ? '' : linha.slice(separador + 1);
    if (valor.startsWith(' ')) {
      valor = valor.slice(1);
    }
    if (campo === 'event') {
      this.tipo = valor;
    } else if (campo === 'data') {
      this.dados.push(valor);
    } else if (campo === 'id') {
      this.id = valor;
    }
    return null;
  }
}
