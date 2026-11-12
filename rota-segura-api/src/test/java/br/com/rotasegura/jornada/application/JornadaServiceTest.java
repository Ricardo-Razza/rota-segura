package br.com.rotasegura.jornada.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.alunos.integration.AlunosClient;
import br.com.rotasegura.alunos.integration.MatriculaDto;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.dispositivos.integration.DispositivosClient;
import br.com.rotasegura.jornada.domain.EstadoJornada;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.jornada.domain.TipoDivergencia;
import br.com.rotasegura.presenca.integration.PresencaClient;
import br.com.rotasegura.presenca.integration.PresencaDto;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.ResultadoCache;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Serviço da jornada com clientes simulados, relógio fixo e somente dados fictícios. */
class JornadaServiceTest {

    private static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");
    private static final LocalDate DIA = LocalDate.of(2026, 3, 10);
    private static final Instant OBTIDO = Instant.parse("2026-03-10T10:00:00Z");

    private final AlunosClient alunos = mock(AlunosClient.class);
    private final DispositivosClient dispositivos = mock(DispositivosClient.class);
    private final PresencaClient presencas = mock(PresencaClient.class);
    private final JornadaProperties propriedades = new JornadaProperties(ZONA, Duration.ofMinutes(40),
            Duration.ofMinutes(2), LocalTime.NOON, Map.of("Vespertino", LocalTime.of(17, 0)),
            new JornadaProperties.TiposLeitor(List.of("1"), List.of("2")));

    @BeforeEach
    void cadastrosFicticios() {
        when(dispositivos.listarTodos()).thenReturn(atual(List.of(
                leitor("11", "1", "7", "50"),
                leitor("21", "2", "", "50"),
                leitor("41", "2", null, "60"),
                leitor("31", "9", "7", "50"),
                leitor("sem-id", "1", "7", "50"))));

        when(alunos.listarTodos()).thenReturn(atual(List.of(
                aluno("101", "2026", "Matutino"),
                aluno("102", "2026", "Matutino"),
                aluno("103", "2026", "Vespertino"),
                aluno("104", "2025", "Matutino"),
                aluno("106", "2026", "Matutino"))));

        when(presencas.listarTodas()).thenReturn(atual(List.of(
                presenca("1", "101", "2026-03-10 07:00:00", "11"),
                presenca("2", "101", "2026-03-10 07:00:40", "11"),
                presenca("3", "101", "2026-03-10 07:25:00", "21"),
                // Com fuso: 10:00Z é 07:00 no horário de Brasília.
                presenca("4", "102", "2026-03-10T10:00:00Z", "11"),
                presenca("5", "105", "10/03/2026 07:30", "41"),
                presenca("6", "103", "2026-03-10 07:05:00", "31"),
                presenca("7", "103", "2026-03-10 07:06:00", "999"),
                presenca("8", "106", "lixo", "11"),
                presenca("9", "101", "2026-03-09 07:00:00", "11"))));
    }

    private JornadaService servicoAs(String horaLocal) {
        Instant instante = DIA.atTime(LocalTime.parse(horaLocal)).atZone(ZONA).toInstant();
        return new JornadaService(alunos, dispositivos, presencas, new ClassificadorDeLeitores(propriedades),
                propriedades, Clock.fixed(instante, ZoneOffset.UTC));
    }

    @Test
    void montaAJornadaDeCadaAlunoDoAnoLetivoEDeQuemTeveLeitura() {
        ResumoJornadas resumo = servicoAs("07:45").doDia(DIA, null);

        assertThat(resumo.jornadas()).extracting(JornadaDoDia::alunoId)
                .as("104 só tem matrícula em 2025; 105 entra por ter leitura no dia")
                .containsExactly(101L, 102L, 103L, 105L, 106L);
        assertThat(estadoDe(resumo, 101)).isEqualTo(EstadoJornada.NA_ESCOLA);
        assertThat(estadoDe(resumo, 102)).isEqualTo(EstadoJornada.DIVERGENTE);
        assertThat(estadoDe(resumo, 103)).isEqualTo(EstadoJornada.AGUARDANDO);
        assertThat(estadoDe(resumo, 105)).isEqualTo(EstadoJornada.NA_ESCOLA);
        assertThat(estadoDe(resumo, 106)).isEqualTo(EstadoJornada.AGUARDANDO);
        assertThat(jornadaDe(resumo, 101).tempoTrajetoMin()).isEqualTo(25L);
        assertThat(jornadaDe(resumo, 101).veiculoId()).isEqualTo(7L);
        assertThat(jornadaDe(resumo, 102).temDivergencia(TipoDivergencia.EMBARCOU_SEM_CHEGADA)).isTrue();
        assertThat(jornadaDe(resumo, 105).temDivergencia(TipoDivergencia.CHEGOU_SEM_EMBARQUE)).isTrue();
        assertThat(resumo.avaliadoEm()).isEqualTo(DIA.atTime(7, 45));
    }

    @Test
    void contaCadaLeituraDescartadaPeloMotivo() {
        ResumoJornadas resumo = servicoAs("07:45").doDia(DIA, null);

        assertThat(resumo.descartes()).isEqualTo(new ResumoJornadas.Descartes(1, 0, 1, 1, 1));
        assertThat(resumo.leitoresComTipoDesconhecido()).containsExactly(31L);
    }

    @Test
    void filtraPorEscolaDoLeitor() {
        ResumoJornadas resumo = servicoAs("07:45").doDia(DIA, 50L);

        assertThat(resumo.jornadas()).extracting(JornadaDoDia::alunoId).containsExactly(101L, 102L);
        assertThat(resumo.descartes().duplicadas()).isEqualTo(1);
    }

    @Test
    void limiteDeAusenciaRespeitaOTurnoDaMatricula() {
        ResumoJornadas resumo = servicoAs("13:00").doDia(DIA, null);

        assertThat(estadoDe(resumo, 106)).as("matutino passou do limite padrão").isEqualTo(EstadoJornada.AUSENTE);
        assertThat(estadoDe(resumo, 103)).as("vespertino: limite 17:00").isEqualTo(EstadoJornada.AGUARDANDO);
    }

    @Test
    void marcaDesatualizadoEIncompletoQuandoAApiExternaFalhaOuTrunca() {
        when(presencas.listarTodas()).thenReturn(new ResultadoCache<>(
                new ColecaoPaginada<>(List.of(), 200, true), OBTIDO, true));

        ResumoJornadas resumo = servicoAs("07:45").doDia(DIA, null);

        assertThat(resumo.desatualizado()).isTrue();
        assertThat(resumo.incompleto()).isTrue();
    }

    @Test
    void dadosEmDiaNaoSaoDesatualizados() {
        ResumoJornadas resumo = servicoAs("07:45").doDia(DIA, null);

        assertThat(resumo.desatualizado()).isFalse();
        assertThat(resumo.incompleto()).isFalse();
    }

    @Test
    void jornadaDeUmAluno() {
        when(alunos.buscarPorId(102)).thenReturn(new ResultadoCache<>(aluno("102", "2026", "Matutino"), OBTIDO, false));

        JornadaDoDia jornada = servicoAs("07:30").doAluno(102, DIA);

        assertThat(jornada.estado()).isEqualTo(EstadoJornada.EMBARCADO);
        assertThat(jornada.embarqueEm()).isEqualTo(DIA.atTime(7, 0));
    }

    @Test
    void diaSemLeiturasDeixaTodosAguardando() {
        ResumoJornadas resumo = servicoAs("07:45").doDia(DIA.plusDays(1), null);

        assertThat(resumo.jornadas()).extracting(JornadaDoDia::estado).containsOnly(EstadoJornada.AGUARDANDO);
    }

    private static EstadoJornada estadoDe(ResumoJornadas resumo, long alunoId) {
        return jornadaDe(resumo, alunoId).estado();
    }

    private static JornadaDoDia jornadaDe(ResumoJornadas resumo, long alunoId) {
        return resumo.jornadas().stream().filter(j -> j.alunoId() == alunoId).findFirst().orElseThrow();
    }

    private static <T> ResultadoCache<ColecaoPaginada<T>> atual(List<T> itens) {
        return new ResultadoCache<>(new ColecaoPaginada<>(itens, 1, false), OBTIDO, false);
    }

    private static DispositivoFacialDto leitor(String id, String tipo, String veiculoId, String escolaId) {
        return new DispositivoFacialDto(id, "Leitor fictício " + id, veiculoId, "00:00:00:00:00:00", "P-01", "R-01",
                tipo, "Tipo fictício", "-10.0", "-50.0", escolaId);
    }

    private static AlunoDto aluno(String id, String anoLetivo, String turno) {
        MatriculaDto matricula = new MatriculaDto("900", "Turma fictícia", anoLetivo, "Escola Fictícia",
                turno, "1º ano", "Ativa");
        return new AlunoDto(id, "Aluno Fictício " + id, null, null, null, "1", null, "1", List.of(matricula));
    }

    private static PresencaDto presenca(String id, String alunoId, String dataHora, String leitorId) {
        return new PresencaDto(id, alunoId, dataHora, null, leitorId, null, null, null, null);
    }
}
