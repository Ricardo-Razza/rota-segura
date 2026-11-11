import { ParserSse } from './parser-sse';

describe('ParserSse', () => {
  it('lê evento com tipo, id e dados', () => {
    const eventos = new ParserSse().alimentar('event: jornada.atualizada\nid: 7\ndata: {"alunoId":42}\n\n');

    expect(eventos).toEqual([{ tipo: 'jornada.atualizada', id: '7', dados: '{"alunoId":42}' }]);
  });

  it('junta um evento que chega partido em vários pedaços', () => {
    const parser = new ParserSse();

    expect(parser.alimentar('event: alerta.cri')).toEqual([]);
    expect(parser.alimentar('ado\ndata: {"id"')).toEqual([]);
    expect(parser.alimentar(':1}\n\n')).toEqual([{ tipo: 'alerta.criado', id: null, dados: '{"id":1}' }]);
  });

  it('aceita CRLF, comentários e várias linhas de dados', () => {
    const eventos = new ParserSse().alimentar(': ping\r\ndata: a\r\ndata: b\r\n\r\n');

    expect(eventos).toEqual([{ tipo: 'message', id: null, dados: 'a\nb' }]);
  });

  it('mantém o último id e volta o tipo ao padrão entre eventos', () => {
    const eventos = new ParserSse().alimentar('event: heartbeat\nid: 3\ndata: {}\n\ndata: x\n\n');

    expect(eventos).toEqual([
      { tipo: 'heartbeat', id: '3', dados: '{}' },
      { tipo: 'message', id: '3', dados: 'x' },
    ]);
  });

  it('ignora bloco sem dados', () => {
    expect(new ParserSse().alimentar('event: vazio\n\n')).toEqual([]);
  });
});
