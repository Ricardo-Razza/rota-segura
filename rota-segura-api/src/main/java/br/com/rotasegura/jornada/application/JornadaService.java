package br.com.rotasegura.jornada.application;

import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.alunos.integration.AlunosClient;
import br.com.rotasegura.alunos.integration.MatriculaDto;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.dispositivos.integration.DispositivosClient;
import br.com.rotasegura.jornada.application.ClassificadorDeLeitores.Classificacao;
import br.com.rotasegura.jornada.application.ResumoJornadas.Descartes;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.jornada.domain.JornadaDoDia.LeiturasIgnoradas;
import br.com.rotasegura.jornada.domain.Leitura;
import br.com.rotasegura.jornada.domain.MotorJornada;
import br.com.rotasegura.presenca.integration.PresencaClient;
import br.com.rotasegura.presenca.integration.PresencaDto;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.Conversoes;
import br.com.rotasegura.shared.integration.ResultadoCache;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Monta a jornada do dia de cada aluno cruzando {@code presenca_escolar} com os leitores faciais.
 *
 * <p>Alunos considerados: os que têm matrícula no ano letivo da data, mais qualquer aluno com leitura no dia.
 * A API não oferece filtro por data em {@code presenca_escolar}: as leituras são lidas (com cache de 30 s)
 * e filtradas aqui.
 *
 * <p>Filtro por escola: usa a escola do leitor (chegada ou, antes dela, embarque). Alunos sem nenhuma leitura
 * não têm escola conhecida, porque a matrícula da API traz só o nome da escola, e ficam fora desse filtro.
 */
@Service
public class JornadaService {

    private static final Logger LOG = LoggerFactory.getLogger(JornadaService.class);

    private final AlunosClient alunos;
    private final DispositivosClient dispositivos;
    private final PresencaClient presencas;
    private final ClassificadorDeLeitores classificador;
    private final JornadaProperties propriedades;
    private final MotorJornada motor;
    private final Clock relogio;

    public JornadaService(AlunosClient alunos, DispositivosClient dispositivos, PresencaClient presencas,
                          ClassificadorDeLeitores classificador, JornadaProperties propriedades, Clock relogio) {
        this.alunos = alunos;
        this.dispositivos = dispositivos;
        this.presencas = presencas;
        this.classificador = classificador;
        this.propriedades = propriedades;
        this.motor = new MotorJornada(propriedades.regras());
        this.relogio = relogio;
    }

    /** Jornadas do dia; {@code escolaId} nulo traz todas as escolas. */
    public ResumoJornadas doDia(LocalDate data, Long escolaId) {
        Objects.requireNonNull(data, "data");
        LocalDateTime agora = agora();
        ResultadoCache<ColecaoPaginada<AlunoDto>> cadastro = alunos.listarTodos();
        Contexto contexto = carregarContexto(data);

        Map<Long, String> turnoPorAluno = new HashMap<>();
        for (AlunoDto aluno : cadastro.valor().itens()) {
            Long id = Conversoes.paraLong(aluno.id());
            matriculaDoAno(aluno, data.getYear()).ifPresent(m -> {
                if (id != null) {
                    turnoPorAluno.put(id, m.escolaTurmaTurnoDescricao());
                }
            });
        }
        // Quem teve leitura no dia entra mesmo sem matrícula no ano: a leitura prova que o aluno existe.
        contexto.leiturasPorAluno.keySet().forEach(id -> turnoPorAluno.putIfAbsent(id, null));

        List<JornadaDoDia> jornadas = new ArrayList<>();
        LeiturasIgnoradas ignoradas = LeiturasIgnoradas.NENHUMA;
        for (Map.Entry<Long, String> aluno : turnoPorAluno.entrySet()) {
            JornadaDoDia jornada = montar(aluno.getKey(), aluno.getValue(), data, agora, contexto);
            if (escolaId == null || escolaId.equals(jornada.escolaId())) {
                jornadas.add(jornada);
                ignoradas = ignoradas.somar(jornada.leiturasIgnoradas());
            }
        }
        jornadas.sort(Comparator.comparingLong(JornadaDoDia::alunoId));

        return new ResumoJornadas(data, agora, jornadas,
                contexto.descartes(ignoradas), contexto.classificacao.tipoDesconhecido(),
                cadastro.desatualizado() || contexto.desatualizado,
                cadastro.valor().truncada() || contexto.incompleto);
    }

    /** Jornada de um aluno num dia. Lança {@code RecursoNaoEncontradoException} se o aluno não existir. */
    public JornadaDoDia doAluno(long alunoId, LocalDate data) {
        Objects.requireNonNull(data, "data");
        AlunoDto aluno = alunos.buscarPorId(alunoId).valor();
        String turno = matriculaDoAno(aluno, data.getYear()).map(MatriculaDto::escolaTurmaTurnoDescricao).orElse(null);
        return montar(alunoId, turno, data, agora(), carregarContexto(data));
    }

    private JornadaDoDia montar(long alunoId, String turno, LocalDate data, LocalDateTime agora, Contexto contexto) {
        LocalTime limite = propriedades.limiteAusenciaDoTurno(turno);
        List<Leitura> leituras = contexto.leiturasPorAluno.getOrDefault(alunoId, List.of());
        return motor.montar(alunoId, data, leituras, contexto.classificacao.leitores(), agora, data.atTime(limite));
    }

    private LocalDateTime agora() {
        return LocalDateTime.ofInstant(relogio.instant(), propriedades.zona());
    }

    private static Optional<MatriculaDto> matriculaDoAno(AlunoDto aluno, int ano) {
        if (aluno.matriculas() == null) {
            return Optional.empty();
        }
        return aluno.matriculas().stream()
                .filter(m -> Long.valueOf(ano).equals(Conversoes.paraLong(m.escolaTurmaAnoLetivo())))
                .findFirst();
    }

    /** Leitores classificados e leituras válidas do dia, agrupadas por aluno. */
    private Contexto carregarContexto(LocalDate data) {
        ResultadoCache<ColecaoPaginada<DispositivoFacialDto>> cadastroLeitores = dispositivos.listarTodos();
        Classificacao classificacao = classificador.classificar(cadastroLeitores.valor().itens());
        if (!classificacao.tipoDesconhecido().isEmpty()) {
            // Só ids: nenhum dado pessoal em log.
            LOG.warn("Leitores com tipo de uso não mapeado (ignorados): {}", classificacao.tipoDesconhecido());
        }

        ResultadoCache<ColecaoPaginada<PresencaDto>> registros = presencas.listarTodas();
        Contexto contexto = new Contexto(classificacao,
                cadastroLeitores.desatualizado() || registros.desatualizado(),
                cadastroLeitores.valor().truncada() || registros.valor().truncada());

        for (PresencaDto registro : registros.valor().itens()) {
            Long alunoId = Conversoes.paraLong(registro.alunoId());
            Long leitorId = Conversoes.paraLong(registro.dispositivoFacialId());
            LocalDateTime dataHora = Conversoes.paraDataHora(registro.dataHora(), propriedades.zona());
            if (alunoId == null || leitorId == null || dataHora == null) {
                // Sem data legível não dá para saber o dia; conta no dia avaliado para não sumir de vista.
                contexto.semDadosValidos++;
                continue;
            }
            if (!dataHora.toLocalDate().equals(data)) {
                continue;
            }
            if (!classificacao.leitores().containsKey(leitorId)) {
                if (classificacao.tipoDesconhecido().contains(leitorId)) {
                    contexto.tipoDeLeitorDesconhecido++;
                } else {
                    contexto.leitorNaoCadastrado++;
                }
                continue;
            }
            Leitura leitura = new Leitura(Conversoes.paraLong(registro.id()), alunoId, dataHora, leitorId,
                    Conversoes.paraLong(registro.veiculoId()));
            contexto.leiturasPorAluno.computeIfAbsent(alunoId, id -> new ArrayList<>()).add(leitura);
        }
        return contexto;
    }

    private static final class Contexto {

        final Classificacao classificacao;
        final boolean desatualizado;
        final boolean incompleto;
        final Map<Long, List<Leitura>> leiturasPorAluno = new HashMap<>();
        int semDadosValidos;
        int tipoDeLeitorDesconhecido;
        int leitorNaoCadastrado;

        Contexto(Classificacao classificacao, boolean desatualizado, boolean incompleto) {
            this.classificacao = classificacao;
            this.desatualizado = desatualizado;
            this.incompleto = incompleto;
        }

        Descartes descartes(LeiturasIgnoradas ignoradas) {
            return new Descartes(ignoradas.duplicadas(), ignoradas.foraDeOrdem(),
                    tipoDeLeitorDesconhecido, leitorNaoCadastrado, semDadosValidos);
        }
    }
}
