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

/** Análises fictícias: 20 dias letivos, três escolas inventadas, sem nenhum aluno identificado. */
const ESCOLAS_FICTICIAS = ['Escola Modelo Fictícia', 'Escola Exemplo Norte', 'Escola Exemplo Sul'];
const ind = (atual: number | null, anterior: number | null, variacao: number | null) => ({
  atual,
  anterior,
  variacao,
});
const diasDaSerie = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date(hoje);
    d.setDate(d.getDate() - (n - 1 - i));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });

function analise(aba: string): unknown {
  const dias = diasDaSerie(20);
  const periodo = { inicio: dias[0], fim: dias[dias.length - 1] };
  const referencia = { inicio: '2000-01-01', fim: '2000-01-20' };
  const onda = (i: number, base: number, amp: number) =>
    Math.round((base + amp * Math.sin(i / 2.5)) * 10) / 10;
  if (aba === 'frequencia') {
    const grupo = (chave: string, rotulo: string, f: number, antes: number) => ({
      chave,
      rotulo,
      esperados: 400,
      presentes: Math.round(f * 4),
      frequencia: f,
      anterior: antes,
      variacao: Math.round((f - antes) * 10) / 10,
      faixa: f < 60 ? 'CRITICO' : f <= 85 ? 'ATENCAO' : 'OK',
    });
    return {
      periodo,
      referencia,
      granularidade: 'DIA',
      frequencia: ind(89.4, 87.1, 2.3),
      diasLetivos: 20,
      alunosAvaliados: 1240,
      abaixoDoLimite: ind(38, 48, -20.8),
      limiteRisco: 75,
      serie: dias.map((inicio, i) => ({
        inicio,
        esperados: 62,
        presentes: 55,
        frequencia: onda(i, 89, 3),
      })),
      serieReferencia: dias.map((inicio, i) => ({
        inicio,
        esperados: 62,
        presentes: 54,
        frequencia: onda(i + 1, 87, 2.5),
      })),
      porEscola: [
        grupo('1', ESCOLAS_FICTICIAS[0], 93.1, 88.2),
        grupo('2', ESCOLAS_FICTICIAS[1], 88.6, 89.4),
        grupo('3', ESCOLAS_FICTICIAS[2], 79.8, 84.4),
      ],
      porEtapa: [
        grupo('INFANTIL', 'INFANTIL', 91.2, 89.9),
        grupo('FUNDAMENTAL', 'FUNDAMENTAL', 88.1, 85.6),
      ],
      porTurno: [
        grupo('MATUTINO', 'Matutino', 90.4, 88),
        grupo('VESPERTINO', 'Vespertino', 86.9, 86.1),
      ],
      porDiaSemana: [
        grupo('MONDAY', 'Seg', 84.2, 83),
        grupo('TUESDAY', 'Ter', 91.5, 90),
        grupo('WEDNESDAY', 'Qua', 92.8, 91),
        grupo('THURSDAY', 'Qui', 91.1, 90.2),
        grupo('FRIDAY', 'Sex', 86.3, 85),
      ],
      etapasConfiguradas: true,
      desatualizado: false,
      incompleto: false,
    };
  }
  if (aba === 'matriculas') {
    const comp = (chave: string, atual: number, anterior: number) => ({
      chave,
      rotulo: chave,
      atual,
      anterior,
      variacao: Math.round(((atual - anterior) * 1000) / anterior) / 10,
    });
    return {
      anoLetivo: ANO,
      agrupamento: 'ETAPA',
      total: ind(1240, 1182, 4.9),
      turmas: ind(52, 50, 4),
      porAno: [ANO - 3, ANO - 2, ANO - 1, ANO].map((ano, i) => ({
        ano,
        total: 1050 + i * 64,
        porGrupo: { INFANTIL: 380 + i * 20, FUNDAMENTAL: 670 + i * 44 },
      })),
      porAnoEscolar: [comp('1º ano', 160, 150), comp('2º ano', 148, 151), comp('3º ano', 171, 160)],
      porEscola: [
        comp(ESCOLAS_FICTICIAS[0], 480, 440),
        comp(ESCOLAS_FICTICIAS[1], 410, 412),
        comp(ESCOLAS_FICTICIAS[2], 350, 330),
      ],
      porTurno: [comp('Matutino', 720, 690), comp('Vespertino', 520, 492)],
      cobertura: [
        {
          chave: 'BIOMETRIA',
          rotulo: 'Rosto cadastrado no leitor',
          com: 1190,
          total: 1240,
          percentual: 96,
          disponivel: true,
        },
        {
          chave: 'VEICULO',
          rotulo: 'Com veículo no cadastro',
          com: 1004,
          total: 1240,
          percentual: 81,
          disponivel: true,
        },
        {
          chave: 'RESPONSAVEL',
          rotulo: 'Com responsável vinculado',
          com: 0,
          total: 0,
          percentual: null,
          disponivel: false,
        },
      ],
      desatualizado: false,
      incompleto: false,
    };
  }
  return {
    periodo,
    referencia,
    granularidade: 'DIA',
    janelaMin: 40,
    embarques: ind(4120, 3980, 3.5),
    viagens: ind(180, 176, 2.3),
    tempoMedioMin: ind(27.4, 29.1, -1.7),
    noPrazo: ind(93.8, 91.2, 2.6),
    serie: dias.map((inicio, i) => ({
      inicio,
      embarques: Math.round(onda(i, 206, 14)),
      tempoMedioMin: onda(i + 3, 27, 2),
      noPrazo: onda(i, 93, 3),
      alertas: i % 4 === 0 ? 2 : 1,
      criticos: i % 6 === 0 ? 1 : 0,
    })),
    serieReferencia: dias.map((inicio, i) => ({
      inicio,
      embarques: Math.round(onda(i + 1, 198, 12)),
      tempoMedioMin: 29,
      noPrazo: 91,
      alertas: 0,
      criticos: 0,
    })),
    veiculos: [
      {
        id: 7,
        placa: 'AAA0A07',
        prefixo: 'P-07',
        viagens: 20,
        embarques: 1460,
        semChegada: 3,
        tempoMedioMin: 25.1,
        noPrazo: 97.2,
        alertas: 2,
      },
      {
        id: 8,
        placa: 'BBB0B08',
        prefixo: 'P-08',
        viagens: 20,
        embarques: 1390,
        semChegada: 9,
        tempoMedioMin: 28.9,
        noPrazo: 91.4,
        alertas: 5,
      },
      {
        id: 9,
        placa: 'CCC0C09',
        prefixo: 'P-09',
        viagens: 19,
        embarques: 1270,
        semChegada: 14,
        tempoMedioMin: 31.6,
        noPrazo: 82.7,
        alertas: 9,
      },
    ],
    alertas: {
      total: ind(26, 31, -16.1),
      abertos: 4,
      porSeveridade: { CRITICO: 4, ATENCAO: 15, INFO: 7 },
      porTipo: {
        LEITOR_SEM_LEITURA: 11,
        EMBARCOU_SEM_CHEGADA: 4,
        CHEGOU_SEM_EMBARQUE: 7,
        LOTACAO: 4,
      },
      tempoMedioResolucaoMin: 38.5,
    },
    desatualizado: false,
    incompleto: false,
  };
}

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
      leituraId: 9001,
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
            leituraId: 9002,
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
  origemPrevisao: 'GPS',
  chegadaNormal: '07:20:00',
  diferencaMin: 10,
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
        etapas: ['INFANTIL', 'FUNDAMENTAL'],
        turnos: ['Matutino', 'Vespertino'],
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
    const locais = caminho.match(/^\/alunos\/(\d+)\/jornadas\/([\d-]+)\/locais$/);
    if (locais) {
      // Coordenadas inventadas: o embarque vem do GPS do ônibus; a chegada, sem local.
      const j = JORNADAS.find((x) => x.aluno.id === Number(locais[1]))?.jornada;
      return json({
        alunoId: Number(locais[1]),
        data: locais[2],
        passos: (j?.passos ?? []).map((p, i) => ({
          dataHora: p.dataHora,
          tipo: p.tipo,
          veiculoId: p.veiculoId,
          escolaId: p.escolaId,
          estadoResultante: p.estadoResultante,
          latitude: i === 0 ? -15.7801 : null,
          longitude: i === 0 ? -47.9292 : null,
          origemLocal: i === 0 ? 'GPS_ONIBUS' : null,
          statusNotificacao: i === 0 ? 'Enviado' : null,
        })),
        desatualizado: false,
        incompleto: false,
      });
    }
    if (caminho === '/veiculos/rastreamento') {
      return json({
        avaliadoEm: `${DIA}T07:20:00`,
        intervaloS: 5,
        raioCercaM: 300,
        veiculos: [
          {
            veiculoId: VEICULO.id,
            escolaId: 1,
            posicao: {
              latitude: -15.7852,
              longitude: -47.9221,
              velocidadeKmh: 28,
              rumo: 120,
              emMovimento: true,
              registradaEm: `${DIA}T07:20:00`,
            },
            atrasada: false,
            falhando: false,
            distanciaEscolaM: 1200,
            naCercaDaEscola: false,
            naCercaDesde: null,
            rastro: [
              { latitude: -15.7801, longitude: -47.9292, em: `${DIA}T07:05:00` },
              { latitude: -15.7852, longitude: -47.9221, em: `${DIA}T07:15:00` },
            ],
          },
        ],
      });
    }
    if (caminho === `/veiculos/${VEICULO.id}`) {
      return json({
        veiculo: VEICULO,
        embarcados: [],
        ultimasLeituras: [],
        desatualizado: false,
        incompleto: false,
      });
    }
    const trajeto = caminho.match(/^\/veiculos\/(\d+)\/trajeto$/);
    if (trajeto) {
      const em = (h: string) => `${DIA}T${h}`;
      return json({
        veiculoId: Number(trajeto[1]),
        data: DIA,
        pontos: [
          { latitude: -15.7801, longitude: -47.9292, em: em('07:05:00') },
          { latitude: -15.7852, longitude: -47.9221, em: em('07:15:00') },
          { latitude: -15.7905, longitude: -47.9163, em: em('07:25:00') },
        ],
        embarques: [
          { em: em('07:05:00'), latitude: -15.7801, longitude: -47.9292 },
          { em: em('07:15:00'), latitude: -15.7852, longitude: -47.9221 },
        ],
        escola: { escolaId: 1, latitude: -15.7925, longitude: -47.914, raioM: 300 },
        desatualizado: false,
      });
    }
    if (/^\/veiculos\/\d+\/paradas$/.test(caminho)) {
      const parada = (latitude: number, longitude: number, h: string) => ({
        latitude,
        longitude,
        embarques: 9,
        alunos: 1,
        dias: 9,
        horariosTipicos: [h],
      });
      return json({
        veiculoId: Number(caminho.split('/')[2]),
        diasAnalisados: 9,
        embarquesLocalizados: 18,
        paradas: [parada(-15.7801, -47.9292, '07:05:00'), parada(-15.7852, -47.9221, '07:15:00')],
      });
    }
    const rastreio = caminho.match(/^\/veiculos\/(\d+)\/rastreamento$/);
    if (rastreio) {
      const em = (h: string) => new Date(`${DIA}T${h}`).toISOString();
      return json({
        veiculoId: Number(rastreio[1]),
        escolaId: 1,
        posicao: null,
        atrasada: true,
        falhando: false,
        distanciaEscolaM: null,
        naCercaDaEscola: false,
        naCercaDesde: null,
        rastro: [
          { latitude: -15.7801, longitude: -47.9292, em: em('07:05:00') },
          { latitude: -15.7852, longitude: -47.9221, em: em('07:15:00') },
          { latitude: -15.7905, longitude: -47.9163, em: em('07:25:00') },
        ],
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

    if (caminho.startsWith('/analises/')) {
      chamadas.push(`ANALISE ${caminho}?${url.searchParams.toString()}`);
      return json(analise(caminho.slice('/analises/'.length)));
    }

    return json({ type: 'urn:rota-segura:erro:nao-simulado', title: caminho, status: 404 }, 404);
  });

  return { chamadas };
}
