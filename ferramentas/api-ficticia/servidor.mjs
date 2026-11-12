// API externa FICTÍCIA para demonstração local do painel (somente GET, como a real).
// Todos os nomes, ids, placas e coordenadas são inventados e gerados de forma determinística.
// Uso: node ferramentas/api-ficticia/servidor.mjs [porta]   (padrão 9999)
import { createServer } from 'node:http';

const PORTA = Number(process.argv[2] ?? process.env.PORTA ?? 9999);
const POR_PAGINA = 100;
const DIAS_HISTORICO = 25;

// ---------- gerador determinístico ----------
let semente = 20260311;
const aleatorio = () => {
  semente = (semente * 1103515245 + 12345) % 2147483648;
  return semente / 2147483648;
};
const escolher = (lista) => lista[Math.floor(aleatorio() * lista.length)];
const pad = (n) => String(n).padStart(2, '0');
const dataTexto = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dataHora = (d, min) => `${dataTexto(d)} ${pad(Math.floor(min / 60))}:${pad(min % 60)}:${pad(Math.floor(aleatorio() * 60))}`;

const ANO = new Date().getFullYear();

// ---------- cadastro fictício ----------
const ESCOLAS = [
  { id: 1, nome: 'Escola Municipal Fictícia Aurora', lat: -27.5951, lon: -48.548 },
  { id: 2, nome: 'Escola Municipal Fictícia Horizonte', lat: -27.6105, lon: -48.5262 },
  { id: 3, nome: 'Escola Municipal Fictícia Primavera', lat: -27.5822, lon: -48.5121 },
];
const ANOS = ['Pré II', '1º ano', '2º ano', '3º ano', '4º ano', '5º ano'];

const VEICULOS = [1, 2, 3, 4, 5, 6].map((id) => ({
  id: String(id),
  placa: `TST${id}A${pad(id * 7)}`,
  marca: 'Marca Exemplo',
  modelo: 'Ônibus Escolar Demo',
  identificador_rastreador: `RAST-DEMO-${id}`,
  imagem: null,
  cor: 'Amarelo',
  prefixo: `R-${pad(id)}`,
  escolaId: ((id - 1) % 3) + 1,
}));

const DISPOSITIVOS = [
  ...VEICULOS.map((v) => ({
    id: String(100 + Number(v.id)),
    descricao: `Leitor fictício do ônibus ${v.prefixo}`,
    veiculo_id: v.id,
    mac: `00:00:5E:00:53:${pad(Number(v.id))}`,
    veiculo_prefixo: v.prefixo,
    veiculo_identificador_rastreador: v.identificador_rastreador,
    tipo_de_uso_dispositivo_id: '1',
    tipo_de_uso_dispositivo_descricao: 'VEICULAR',
    escola_latitude: '',
    escola_longitude: '',
    escola_id: '',
  })),
  ...ESCOLAS.map((e) => ({
    id: String(200 + e.id),
    descricao: `Leitor fictício da portaria · ${e.nome}`,
    veiculo_id: '',
    mac: `00:00:5E:00:54:${pad(e.id)}`,
    veiculo_prefixo: '',
    veiculo_identificador_rastreador: '',
    tipo_de_uso_dispositivo_id: '2',
    tipo_de_uso_dispositivo_descricao: 'ESCOLAR',
    escola_latitude: String(e.lat),
    escola_longitude: String(e.lon),
    escola_id: String(e.id),
  })),
];

const PRENOMES = ['Ana', 'Bruno', 'Clara', 'Davi', 'Elisa', 'Felipe', 'Gabi', 'Heitor', 'Iara', 'João',
  'Lara', 'Miguel', 'Nina', 'Otávio', 'Paula', 'Rafael', 'Sofia', 'Tiago', 'Valentina', 'Yuri'];
const SOBRENOMES = ['Exemplo', 'Teste', 'Fictício', 'Modelo', 'Demo', 'Amostra', 'Simulado', 'Protótipo'];

const ALUNOS = [];
for (let i = 1; i <= 132; i++) {
  const escola = ESCOLAS[(i - 1) % 3];
  const anoEscolar = ANOS[Math.floor(aleatorio() * ANOS.length)];
  const letra = escolher(['A', 'B']);
  const veiculos = VEICULOS.filter((v) => v.escolaId === escola.id);
  ALUNOS.push({
    id: String(1000 + i),
    nome: `${escolher(PRENOMES)} ${escolher(SOBRENOMES)} ${escolher(SOBRENOMES)}`,
    cpf: null,
    data_nascimento: null,
    endereco_informado_id: null,
    tipo_status_id: '1',
    imagem: null,
    registrado_dispositivo: aleatorio() < 0.93 ? '1' : '0',
    matriculas: [
      {
        escola_turma_id: String(escola.id * 100 + ANOS.indexOf(anoEscolar) * 2 + (letra === 'A' ? 0 : 1)),
        escola_turma_descricao_turma: `${anoEscolar} ${letra}`,
        escola_turma_ano_letivo: String(ANO),
        escola_turma_escola_nome: escola.nome,
        escola_turma_turno_descricao: 'MATUTINO',
        escola_turma_turma_descricao: anoEscolar,
        escola_turma_situacao_turma_descricao: 'ATIVA',
      },
    ],
    _escola: escola,
    _veiculo: veiculos[i % veiculos.length],
    _assiduidade: 0.75 + aleatorio() * 0.24,
  });
}

const RESPONSAVEIS = ALUNOS.filter((_, i) => i % 4 !== 3).map((a, i) => ({
  id: String(5000 + i),
  nome: `Responsável Fictício ${i + 1}`,
  criado_em: `${ANO}-02-01 08:00:00`,
  excluido_em: null,
  chatwoot_contact_id: null,
  chatwoot_conversation_id: null,
  details: [{ id: a.id, nome: a.nome, matricula: a.matriculas[0].escola_turma_id }],
}));

// ---------- leituras de presença ----------
function diasLetivos() {
  const dias = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (dias.length < DIAS_HISTORICO) {
    if (d.getDay() !== 0 && d.getDay() !== 6) dias.unshift(new Date(d));
    d.setDate(d.getDate() - 1);
  }
  return dias;
}

const PRESENCAS = [];
let idPresenca = 1;
const agora = new Date();
const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
for (const dia of diasLetivos()) {
  const ehHoje = dataTexto(dia) === dataTexto(agora);
  ALUNOS.forEach((a, idx) => {
    if (aleatorio() > a._assiduidade) return; // faltou
    const leitorOnibus = String(100 + Number(a._veiculo.id));
    const leitorEscola = String(200 + a._escola.id);
    const embarque = 6 * 60 + 25 + Math.floor(aleatorio() * 40);
    const chegada = embarque + 18 + Math.floor(aleatorio() * 20);
    const semEmbarque = aleatorio() < 0.02; // chegou de carro
    const semChegada = ehHoje && idx % 37 === 5; // demonstração de divergência crítica
    const registrar = (min, leitor, veiculo) => {
      if (ehHoje && min > minutosAgora) return;
      PRESENCAS.push({
        id: String(idPresenca++),
        aluno_id: a.id,
        data_hora: dataHora(dia, min),
        veiculo_id: veiculo ?? '',
        dispositivo_facial_id: leitor,
        caminho_imagem: null,
        latitude: '',
        longitude: '',
        status_notificacao_descricao: 'ENVIADA',
      });
    };
    if (!semEmbarque) registrar(embarque, leitorOnibus, a._veiculo.id);
    if (!semChegada) registrar(chegada, leitorEscola, null);
  });
}
PRESENCAS.reverse(); // mais recentes primeiro

// ---------- HTTP ----------
const publico = (o) => Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_')));

function paginar(lista, pagina) {
  const ultima = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const atual = Math.min(Math.max(1, pagina), ultima);
  return {
    data: lista.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA).map(publico),
    meta: { total: lista.length, per_page: POR_PAGINA, current_page: atual, last_page: ultima },
  };
}

const RECURSOS = {
  '/api/alunos': ALUNOS,
  '/api/veiculos': VEICULOS,
  '/api/dispositivos_faciais': DISPOSITIVOS,
  '/api/responsaveis': RESPONSAVEIS,
  '/api/presenca_escolar': PRESENCAS,
};

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const enviar = (status, corpo) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(corpo));
  };
  if (req.method !== 'GET') return enviar(405, { message: 'Somente GET nesta API fictícia.' });
  const caminho = url.pathname.replace(/\/$/, '');
  if (caminho === '/api/alunos/sincronizar') return enviar(200, { message: 'Sincronização fictícia concluída.' });
  if (RECURSOS[caminho]) return enviar(200, paginar(RECURSOS[caminho], Number(url.searchParams.get('page') ?? 1)));
  const porId = caminho.match(/^(\/api\/[a-z_]+)\/(\d+)$/);
  if (porId && RECURSOS[porId[1]]) {
    const item = RECURSOS[porId[1]].find((x) => x.id === porId[2]);
    return item ? enviar(200, publico(item)) : enviar(404, { message: 'Não encontrado.' });
  }
  return enviar(404, { message: 'Rota não simulada.' });
}).listen(PORTA, () => {
  console.log(`API fictícia em http://localhost:${PORTA} · ${ALUNOS.length} alunos · ${PRESENCAS.length} leituras`);
});
