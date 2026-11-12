package br.com.rotasegura.jornada.application;

import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.alunos.integration.AlunosClient;
import br.com.rotasegura.alunos.integration.MatriculaDto;
import br.com.rotasegura.jornada.application.LeiturasDaApi.Carga;
import br.com.rotasegura.jornada.application.ResumoJornadas.Descartes;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.jornada.domain.JornadaDoDia.LeiturasIgnoradas;
import br.com.rotasegura.jornada.domain.Leitura;
import br.com.rotasegura.jornada.domain.MotorJornada;
import br.com.rotasegura.shared.application.Periodo;
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
import org.springframework.stereotype.Service;

/**
 * Monta a jornada do dia de cada aluno cruzando {@code presenca_escolar} com os leitores faciais.
 *
 * <p>Alunos considerados: os que têm matrícula no ano letivo da data, mais qualquer aluno com leitura no dia.
 * A API não oferece filtro por data em {@code presenca_escolar}: as leituras são lidas (com cache de 30 s)
 * e filtradas aqui.
 *
 * <p>Filtro por escola: usa a escola do leitor (chegada ou, antes dela, embarque). Alunos sem nenhuma leitura
 * no dia não têm escola conhecida nesse dia e ficam fora desse filtro.
 */
@Service
public class JornadaService {

    private final AlunosClient alunos;
    private final LeiturasDaApi leiturasDaApi;
    private final JornadaProperties propriedades;
    private final MotorJornada motor;
    private final Clock relogio;

    public JornadaService(AlunosClient alunos, LeiturasDaApi leiturasDaApi, JornadaProperties propriedades,
                          Clock relogio) {
        this.alunos = alunos;
        this.leiturasDaApi = leiturasDaApi;
        this.propriedades = propriedades;
        this.motor = new MotorJornada(propriedades.regras());
        this.relogio = relogio;
    }

    /** Cadastro de alunos e leituras carregados uma vez, para avaliar vários dias sem reler a API. */
    public Base carregarBase() {
        ResultadoCache<ColecaoPaginada<AlunoDto>> cadastro = alunos.listarTodos();
        return new Base(cadastro.valor().itens(), leiturasDaApi.carregar(),
                cadastro.desatualizado(), cadastro.valor().truncada());
    }

    /** Jornadas do dia; {@code escolaId} nulo traz todas as escolas. */
    public ResumoJornadas doDia(LocalDate data, Long escolaId) {
        return doDia(data, escolaId, carregarBase());
    }

    public ResumoJornadas doDia(LocalDate data, Long escolaId, Base base) {
        Objects.requireNonNull(data, "data");
        LocalDateTime agora = agora();
        Map<Long, List<Leitura>> leiturasDoDia = new HashMap<>();
        int tipoDesconhecido = 0;
        int naoCadastrado = 0;
        for (Leitura leitura : base.carga().leituras()) {
            if (!leitura.dataHora().toLocalDate().equals(data)) {
                continue;
            }
            if (!base.carga().classificacao().leitores().containsKey(leitura.leitorId())) {
                if (base.carga().classificacao().tipoDesconhecido().contains(leitura.leitorId())) {
                    tipoDesconhecido++;
                } else {
                    naoCadastrado++;
                }
                continue;
            }
            leiturasDoDia.computeIfAbsent(leitura.alunoId(), id -> new ArrayList<>()).add(leitura);
        }

        Map<Long, String> turnoPorAluno = new HashMap<>();
        for (AlunoDto aluno : base.alunos()) {
            Long id = Conversoes.paraLong(aluno.id());
            if (id != null) {
                matriculaDoAno(aluno, data.getYear()).ifPresent(m -> turnoPorAluno.put(id, m.escolaTurmaTurnoDescricao()));
            }
        }
        // Quem teve leitura no dia entra mesmo sem matrícula no ano: a leitura prova que o aluno existe.
        leiturasDoDia.keySet().forEach(id -> turnoPorAluno.putIfAbsent(id, null));

        List<JornadaDoDia> jornadas = new ArrayList<>();
        LeiturasIgnoradas ignoradas = LeiturasIgnoradas.NENHUMA;
        for (Map.Entry<Long, String> aluno : turnoPorAluno.entrySet()) {
            JornadaDoDia jornada = montar(aluno.getKey(), aluno.getValue(), data, agora,
                    leiturasDoDia.getOrDefault(aluno.getKey(), List.of()), base.carga());
            if (escolaId == null || escolaId.equals(jornada.escolaId())) {
                jornadas.add(jornada);
                ignoradas = ignoradas.somar(jornada.leiturasIgnoradas());
            }
        }
        jornadas.sort(Comparator.comparingLong(JornadaDoDia::alunoId));

        Descartes descartes = new Descartes(ignoradas.duplicadas(), ignoradas.foraDeOrdem(),
                tipoDesconhecido, naoCadastrado, base.carga().semDadosValidos());
        return new ResumoJornadas(data, agora, jornadas, descartes,
                base.carga().classificacao().tipoDesconhecido(), base.desatualizado(), base.incompleto());
    }

    /** Jornada de um aluno num dia. Lança {@code RecursoNaoEncontradoException} se o aluno não existir. */
    public JornadaDoDia doAluno(long alunoId, LocalDate data) {
        return doAlunoNoPeriodo(alunoId, new Periodo(data, data)).getFirst();
    }

    /** Jornadas de um aluno em cada dia do período (sem limite aqui: quem chama valida o tamanho). */
    public List<JornadaDoDia> doAlunoNoPeriodo(long alunoId, Periodo periodo) {
        AlunoDto aluno = alunos.buscarPorId(alunoId).valor();
        Carga carga = leiturasDaApi.carregar();
        LocalDateTime agora = agora();
        return periodo.dias().stream().map(dia -> {
            String turno = matriculaDoAno(aluno, dia.getYear()).map(MatriculaDto::escolaTurmaTurnoDescricao).orElse(null);
            List<Leitura> doDia = carga.leituras().stream()
                    .filter(l -> l.alunoId() == alunoId && l.dataHora().toLocalDate().equals(dia))
                    .filter(l -> carga.classificacao().leitores().containsKey(l.leitorId()))
                    .toList();
            return montar(alunoId, turno, dia, agora, doDia, carga);
        }).toList();
    }

    public LocalDateTime agora() {
        return LocalDateTime.ofInstant(relogio.instant(), propriedades.zona());
    }

    public LocalDate hoje() {
        return agora().toLocalDate();
    }

    private JornadaDoDia montar(long alunoId, String turno, LocalDate data, LocalDateTime agora,
                                List<Leitura> leituras, Carga carga) {
        LocalTime limite = propriedades.limiteAusenciaDoTurno(turno);
        return motor.montar(alunoId, data, leituras, carga.classificacao().leitores(), agora, data.atTime(limite));
    }

    /** Matrícula do aluno no ano letivo, se houver. */
    public static Optional<MatriculaDto> matriculaDoAno(AlunoDto aluno, int ano) {
        if (aluno.matriculas() == null) {
            return Optional.empty();
        }
        return aluno.matriculas().stream()
                .filter(m -> Long.valueOf(ano).equals(Conversoes.paraLong(m.escolaTurmaAnoLetivo())))
                .findFirst();
    }

    /**
     * Dados de entrada já carregados.
     *
     * @param desatualizadoCadastro o cadastro de alunos veio do último valor em cache
     * @param incompletoCadastro    o cadastro de alunos parou no limite de páginas
     */
    public record Base(List<AlunoDto> alunosCadastro, Carga carga, boolean desatualizadoCadastro,
                       boolean incompletoCadastro) {

        public Base {
            alunosCadastro = List.copyOf(alunosCadastro);
        }

        public List<AlunoDto> alunos() {
            return alunosCadastro;
        }

        public boolean desatualizado() {
            return desatualizadoCadastro || carga.desatualizado();
        }

        public boolean incompleto() {
            return incompletoCadastro || carga.incompleto();
        }
    }
}
