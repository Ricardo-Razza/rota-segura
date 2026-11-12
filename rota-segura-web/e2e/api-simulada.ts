import { Page, Route } from '@playwright/test';

/**
 * Backend simulado para o e2e: intercepta /api/v1 no navegador (nenhum servidor real é chamado).
 * Somente dados fictícios: nomes, ids e placas inventados.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const hoje = new Date();
const DIA = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;
const AGORA = `${DIA}T08:00:00`;
const ANO = hoje.getFullYear();

const USUARIO = {
  id: 1,
  nome: 'Gestora Fictícia',
  perfil: 'GESTAO',
  escolas: [],
  veiculos: [],
  podeRevelarContato: true,
  podeVerIndicadoresSensiveis: true,
};

const aluno = (id: number, nome: string, iniciais: string) => ({
  id,
  nome,
  iniciais,
  turmaId: 11,
  turma: '3º A',
  anoEscolar: '3º ano',
  turno: 'MATUTINO',
  anoLetivo: ANO,
  escolaNome: 'Escola Modelo Fictícia',
  escolaId: 1,
  veiculoId: 7,
  biometria: true,
});

const ALUNOS = [aluno(101, 'Ana Exemplo', 'AE'), aluno(102, 'Bruno Teste', 'BT')];

const jornada = (alunoId: number, estado: string, chegada: string | null) => ({
  alunoId,
  data: DIA,
  estado,
  embarqueEm: `${DIA}T07:05:00`,
  veiculoId: 7,
  chegadaEm: chegada,
  escolaId: chegada ? 1 : null,
  tempoTrajetoMin: chegada ? 25 : null,
  divergencias: [],
  passos: [
    {
      dataHora: `${DIA}T07:05:00`,
      tipo: 'EMBARQUE',
      leitorId: 501,
      veiculoId: 7,
      escolaId: null,
      estadoResultante: 'EMBARCADO',
    },
    ...(chegada
      ? [
          {
            dataHora: chegada,
            tipo: 'CHEGADA',
            leitorId: 601,
            veiculoId: null,
            escolaId: 1,
            estadoResultante: 'NA_ESCOLA',
          },
        ]
      : []),
  ],
  leiturasIgnoradas: { duplicadas: 0, foraDeOrdem: 0 },
});

const JORNADAS = [
  { aluno: ALUNOS[0], jornada: jornada(101, 'EMBARCADO', null), esperado: true },
  { aluno: ALUNOS[1], jornada: jornada(102, 'NA_ESCOLA', `${DIA}T07:30:00`), esperado: true },
];

const pagina = <T>(itens: T[]) => ({
  itens,
  pagina: 0,
  tamanho: 50,
  total: itens.length,
  totalPaginas: 1,
});

const VEICULO = {
  id: 7,
  placa: 'ABC1D23',
  prefixo: 'R-07',
  descricao: 'Rota fictícia 7',
  estado: 'EM_ROTA',
  embarcados: 2,
  aBordo: 1,
  chegaram: 1,
  esperados: 2,
  capacidade: null,
  ocupacao: null,
  faixaOcupacao: null,
  escolaId: 1,
  latitude: -23.5,
  longitude: -46.6,
  leitores: [501],
  ultimaLeitura: `${DIA}T07:30:00`,
  saida: `${DIA}T07:05:00`,
  tempoMedioMin: 25,
  previsaoChegada: `${DIA}T07:30:00`,
};

function alertaInicial() {
  return {
    id: 900,
    tipo: 'EMBARCOU_SEM_CHEGADA',
    severidade: 'CRITICO',
    status: 'ABERTO',
    entidade: 'ALUNO',
    entidadeId: '101',
    rotulo: 'Aluno #101',
    mensagem: 'Aluno #101 embarcou no veículo R-07 às 07:05 e não passou no leitor da escola.',
    ocorrencias: 3,
    ativo: true,
    primeiraOcorrenciaEm: `${DIA}T07:45:00Z`,
    ultimaOcorrenciaEm: `${DIA}T07:55:00Z`,
    escolaId: 1,
    veiculoId: 7,
    assumidoPor: null,
    assumidoEm: null,
    resolvidoPor: null,
    resolvidoEm: null,
    comentario: null as string | null,
  };
}

export interface ApiSimulada {
  /** Requisições recebidas (método + caminho), para as verificações do teste. */
  chamadas: string[];
}

export async function simularApi(page: Page): Promise<ApiSimulada> {
  const estado = { logado: false, alerta: alertaInicial() };
  const chamadas: string[] = [];

  const resumo = () => {
    const aberto = estado.alerta.status === 'ABERTO';
    return {
      abertosPorSeveridade: aberto ? { CRITICO: 1 } : {},
      abertos: aberto ? 1 : 0,
      emAnalise: estado.alerta.status === 'EM_ANALISE' ? 1 : 0,
    };
  };

  const token = () => ({ accessToken: 'token-ficticio', expiraEmSegundos: 900, usuario: USUARIO });

  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const caminho = url.pathname.replace('/api/v1', '');
    const metodo = req.method();
    chamadas.push(`${metodo} ${caminho}`);
    const json = (corpo: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });

    if (caminho === '/auth/login' && metodo === 'POST') {
      estado.logado = true;
      return json(token());
    }
    if (caminho === '/auth/refresh') {
      return estado.logado
        ? json(token())
        : json({ type: 'urn:rota-segura:erro:nao-autenticado', status: 401 }, 401);
    }
    if (caminho === '/auth/logout') {
      estado.logado = false;
      return route.fulfill({ status: 204 });
    }
    if (caminho === '/stream') {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event: heartbeat\ndata: {}\n\n',
      });
    }
    if (caminho === '/cadastro/opcoes-filtro') {
      return json({
        anoLetivo: ANO,
        escolas: [{ id: 1, nome: 'Escola Modelo Fictícia' }],
        anosEscolares: ['3º ano'],
        turmas: [{ id: 11, nome: '3º A', escolaId: 1, anoEscolar: '3º ano' }],
        desatualizado: false,
      });
    }
    if (caminho === '/alertas/resumo') return json(resumo());
    if (caminho === '/alertas' && metodo === 'GET') {
      const status = url.searchParams.get('status');
      const itens = !status || status === estado.alerta.status ? [estado.alerta] : [];
      return json({ resumo: resumo(), alertas: pagina(itens) });
    }
    if (caminho === `/alertas/${estado.alerta.id}` && metodo === 'PATCH') {
      const corpo = req.postDataJSON() as { status: string; comentario?: string };
      estado.alerta = {
        ...estado.alerta,
        status: corpo.status,
        comentario: corpo.comentario ?? null,
        resolvidoPor: corpo.status === 'RESOLVIDO' ? USUARIO.id : null,
        resolvidoEm: corpo.status === 'RESOLVIDO' ? `${DIA}T08:05:00Z` : null,
      };
      return json(estado.alerta);
    }
    if (caminho === '/dashboard/resumo') {
      return json({
        data: DIA,
        avaliadoEm: AGORA,
        anoLetivo: ANO,
        kpis: {
          alunosAtivos: 2,
          frequenciaHoje: 50,
          naEscolaAgora: 1,
          veiculosEmRota: 1,
          alertasAbertos: resumo().abertos,
          diaLetivo: true,
        },
        etapasConfiguradas: false,
        frequenciaPorEtapa: [],
        matriculas: {
          agrupamento: 'ANO_ESCOLAR',
          anoAtual: ANO,
          porAno: { [ANO]: { '3º ano': 2 } },
        },
        frequenciaHojePorEscola: [
          {
            escolaId: 1,
            escolaNome: 'Escola Modelo Fictícia',
            esperados: 2,
            presentes: 1,
            frequencia: 50,
            faixa: 'CRITICO',
          },
        ],
        frequenciaAnualPorEscola: [
          {
            escolaId: 1,
            escolaNome: 'Escola Modelo Fictícia',
            esperados: 200,
            presentes: 180,
            frequencia: 90,
            faixa: 'OK',
          },
        ],
        porAnoEscolar: [{ anoEscolar: '3º ano', alunos: 2, turmas: 1, docentes: null }],
        usuariosConectados: { GESTAO: 1 },
        desatualizado: false,
        incompleto: false,
      });
    }
    if (caminho === '/dashboard/sensiveis') {
      return json({
        disponivel: false,
        motivo: 'A API externa não informa estes dados.',
        minimoPorGrupo: 5,
        indicadores: [],
      });
    }
    if (caminho === '/jornadas') {
      return json({
        data: DIA,
        avaliadoEm: AGORA,
        porEstado: { EMBARCADO: 1, NA_ESCOLA: 1 },
        jornadas: pagina(JORNADAS),
        descartes: {
          duplicadas: 0,
          foraDeOrdem: 0,
          tipoDeLeitorDesconhecido: 0,
          leitorNaoCadastrado: 0,
          semDadosValidos: 0,
        },
        desatualizado: false,
        incompleto: false,
      });
    }
    const perfil = caminho.match(/^\/alunos\/(\d+)\/perfil$/);
    if (perfil) {
      const linha = JORNADAS.find((j) => j.aluno.id === Number(perfil[1]));
      if (!linha) return json({ status: 404 }, 404);
      return json({
        aluno: linha.aluno,
        jornadaHoje: linha.jornada,
        responsaveis: [
          {
            id: 301,
            nome: 'Responsável Fictício',
            contatoMascarado: null,
            contatoDisponivel: false,
          },
        ],
        situacaoResponsaveis: { pronto: true, completo: true },
        desatualizado: false,
      });
    }
    if (/^\/alunos\/\d+\/jornadas$/.test(caminho)) {
      const id = Number(caminho.split('/')[2]);
      return json(JORNADAS.filter((j) => j.aluno.id === id).map((j) => j.jornada));
    }
    if (caminho === '/alunos' || caminho === '/alunos/busca') {
      return json({
        anoLetivo: ANO,
        alunos: pagina(JORNADAS.map((j) => ({ aluno: j.aluno, estadoHoje: j.jornada.estado }))),
        desatualizado: false,
        incompleto: false,
      });
    }
    if (caminho === '/alunos/sincronizacao/ultima') return json(null);
    if (caminho === '/cadastro/pendencias') {
      return json({
        anoLetivo: ANO,
        porTipo: {},
        alunos: pagina([]),
        responsaveisAvaliados: true,
        desatualizado: false,
        incompleto: false,
      });
    }
    if (caminho === '/veiculos/status') {
      return json({
        avaliadoEm: AGORA,
        porEstado: { EM_ROTA: 1 },
        veiculos: [VEICULO],
        capacidadeNaoConfigurada: true,
        desatualizado: false,
        incompleto: false,
      });
    }
    if (caminho === '/dispositivos/saude') {
      return json({
        avaliadoEm: AGORA,
        limiteOfflineMin: 30,
        porSituacao: { ONLINE: 1 },
        leitores: [
          {
            id: 501,
            descricao: 'Leitor fictício do ônibus',
            tipoUso: 'EMBARQUE',
            tipoUsoDescricao: 'VEICULAR',
            veiculoId: 7,
            veiculoPrefixo: 'R-07',
            escolaId: null,
            ultimaLeitura: `${DIA}T07:30:00`,
            leiturasUltimaHora: 2,
            situacao: 'ONLINE',
          },
        ],
        desatualizado: false,
        incompleto: false,
      });
    }
    if (caminho === '/presenca/hoje') {
      return json({
        data: DIA,
        avaliadoEm: AGORA,
        diaLetivo: true,
        contagem: {
          esperados: 2,
          naEscola: 1,
          embarcados: 1,
          aguardando: 0,
          ausentes: 0,
          divergentes: 0,
          frequencia: 50,
        },
        semPresenca: pagina([JORNADAS[0]]),
        desatualizado: false,
        incompleto: false,
      });
    }
    if (caminho === '/presenca/periodo') {
      return json({
        inicio: DIA,
        fim: DIA,
        dias: [{ data: DIA, esperados: 2, presentes: 1, frequencia: 50 }],
        frequenciaMedia: 50,
        desatualizado: false,
        incompleto: false,
      });
    }
    if (caminho === '/relatorios/previa') {
      return json({
        tabela: {
          titulo: 'Frequência por aluno',
          periodo: 'últimos 7 dias',
          colunas: ['ID', 'Aluno', 'Frequência (%)'],
          linhas: [
            ['101', 'Ana Exemplo', '80,0'],
            ['102', 'Bruno Teste', '100,0'],
          ],
        },
        totalLinhas: 2,
      });
    }
    if (caminho === '/relatorios/frequencia.csv') {
      return route.fulfill({
        status: 200,
        contentType: 'text/csv; charset=UTF-8',
        headers: { 'Content-Disposition': 'attachment; filename="frequencia.csv"' },
        body: '﻿ID;Aluno;Frequência (%)\r\n101;Ana Exemplo;80,0\r\n102;Bruno Teste;100,0\r\n',
      });
    }
    if (caminho === '/relatorios/agendados') return json([]);

    return json({ type: 'urn:rota-segura:erro:nao-simulado', title: caminho, status: 404 }, 404);
  });

  return { chamadas };
}
