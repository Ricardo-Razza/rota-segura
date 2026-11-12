package br.com.rotasegura.jornada.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Motor da jornada com dados fictícios: só ids e horários. */
class MotorJornadaTest {

    private static final LocalDate DIA = LocalDate.of(2026, 3, 10);
    private static final long ALUNO = 101;
    private static final long ONIBUS_A = 7;
    private static final long ONIBUS_B = 8;
    private static final long ESCOLA = 50;

    private static final Leitor LEITOR_ONIBUS_A = new Leitor(11, TipoLeitor.EMBARQUE, ONIBUS_A, ESCOLA);
    private static final Leitor LEITOR_ONIBUS_B = new Leitor(12, TipoLeitor.EMBARQUE, ONIBUS_B, ESCOLA);
    private static final Leitor LEITOR_ESCOLA = new Leitor(21, TipoLeitor.CHEGADA, null, ESCOLA);
    private static final Map<Long, Leitor> LEITORES = Map.of(
            LEITOR_ONIBUS_A.id(), LEITOR_ONIBUS_A,
            LEITOR_ONIBUS_B.id(), LEITOR_ONIBUS_B,
            LEITOR_ESCOLA.id(), LEITOR_ESCOLA);

    private final MotorJornada motor =
            new MotorJornada(new RegrasJornada(Duration.ofMinutes(40), Duration.ofMinutes(2)));

    private static LocalDateTime as(String hora) {
        return DIA.atTime(LocalTime.parse(hora));
    }

    private static Leitura leitura(String hora, Leitor leitor) {
        return new Leitura(null, ALUNO, as(hora), leitor.id(), null);
    }

    private JornadaDoDia montar(String agora, Leitura... leituras) {
        return motor.montar(ALUNO, DIA, List.of(leituras), LEITORES, as(agora), as("12:00"));
    }

    @Nested
    class Transicoes {

        @Test
        void semLeituraAntesDoLimiteFicaAguardando() {
            JornadaDoDia jornada = montar("07:00");

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.AGUARDANDO);
            assertThat(jornada.passos()).isEmpty();
            assertThat(jornada.divergencias()).isEmpty();
        }

        @Test
        void aguardandoParaEmbarcadoVinculaOVeiculoDoLeitor() {
            JornadaDoDia jornada = montar("07:10", leitura("07:00", LEITOR_ONIBUS_A));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.EMBARCADO);
            assertThat(jornada.embarqueEm()).isEqualTo(as("07:00"));
            assertThat(jornada.veiculoId()).isEqualTo(ONIBUS_A);
            assertThat(jornada.escolaId()).as("escola do leitor do ônibus até a chegada").isEqualTo(ESCOLA);
            assertThat(jornada.chegadaEm()).isNull();
            assertThat(jornada.tempoTrajetoMin()).isNull();
        }

        @Test
        void veiculoInformadoNaLeituraTemPrioridadeSobreODoLeitor() {
            Leitura comVeiculo = new Leitura(1L, ALUNO, as("07:00"), LEITOR_ONIBUS_A.id(), 99L);

            JornadaDoDia jornada = montar("07:10", comVeiculo);

            assertThat(jornada.veiculoId()).isEqualTo(99L);
        }

        @Test
        void embarcadoParaNaEscolaCalculaOTempoDeTrajeto() {
            JornadaDoDia jornada = montar("08:00",
                    leitura("07:00", LEITOR_ONIBUS_A),
                    leitura("07:25", LEITOR_ESCOLA));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.NA_ESCOLA);
            assertThat(jornada.chegadaEm()).isEqualTo(as("07:25"));
            assertThat(jornada.escolaId()).isEqualTo(ESCOLA);
            assertThat(jornada.tempoTrajetoMin()).isEqualTo(25L);
            assertThat(jornada.divergencias()).isEmpty();
            assertThat(jornada.passos()).extracting(Passo::tipo, Passo::leitorId, Passo::estadoResultante)
                    .containsExactly(
                            org.assertj.core.groups.Tuple.tuple(TipoLeitor.EMBARQUE, 11L, EstadoJornada.EMBARCADO),
                            org.assertj.core.groups.Tuple.tuple(TipoLeitor.CHEGADA, 21L, EstadoJornada.NA_ESCOLA));
        }

        @Test
        void leiturasForaDeOrdemNaListaSaoOrdenadasPeloHorario() {
            JornadaDoDia jornada = montar("08:00",
                    leitura("07:25", LEITOR_ESCOLA),
                    leitura("07:00", LEITOR_ONIBUS_A));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.NA_ESCOLA);
            assertThat(jornada.divergencias()).isEmpty();
            assertThat(jornada.tempoTrajetoMin()).isEqualTo(25L);
        }

        @Test
        void aguardandoParaAusenteDepoisDoLimite() {
            JornadaDoDia jornada = montar("12:01");

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.AUSENTE);
        }

        @Test
        void exatamenteNoLimiteAindaEstaAguardando() {
            assertThat(montar("12:00").estado()).isEqualTo(EstadoJornada.AGUARDANDO);
        }

        @Test
        void ausenteParaNaEscolaComChegadaTardia() {
            JornadaDoDia jornada = montar("13:00", leitura("12:30", LEITOR_ESCOLA));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.NA_ESCOLA);
            assertThat(jornada.temDivergencia(TipoDivergencia.CHEGOU_SEM_EMBARQUE)).isTrue();
        }

        @Test
        void ausenteParaEmbarcadoComEmbarqueTardio() {
            JornadaDoDia jornada = montar("12:40", leitura("12:30", LEITOR_ONIBUS_A));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.EMBARCADO);
        }

        @Test
        void diaPassadoSemLeituraFicaAusente() {
            JornadaDoDia jornada = motor.montar(ALUNO, DIA, List.of(), LEITORES,
                    DIA.plusDays(3).atTime(9, 0), as("12:00"));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.AUSENTE);
        }
    }

    @Nested
    class Divergencias {

        @Test
        void embarcouSemChegadaDepoisDaJanelaViraDivergenteCritico() {
            JornadaDoDia jornada = montar("07:41", leitura("07:00", LEITOR_ONIBUS_A));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.DIVERGENTE);
            assertThat(jornada.divergencias()).singleElement().satisfies(d -> {
                assertThat(d.tipo()).isEqualTo(TipoDivergencia.EMBARCOU_SEM_CHEGADA);
                assertThat(d.severidade()).isEqualTo(Severidade.CRITICO);
                assertThat(d.detectadaEm()).isEqualTo(as("07:40"));
            });
        }

        @Test
        void exatamenteNaJanelaAindaNaoEhDivergencia() {
            JornadaDoDia jornada = montar("07:40", leitura("07:00", LEITOR_ONIBUS_A));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.EMBARCADO);
            assertThat(jornada.divergencias()).isEmpty();
        }

        @Test
        void janelaEhConfiguravel() {
            MotorJornada janelaCurta = new MotorJornada(new RegrasJornada(Duration.ofMinutes(15), Duration.ofMinutes(2)));

            JornadaDoDia jornada = janelaCurta.montar(ALUNO, DIA, List.of(leitura("07:00", LEITOR_ONIBUS_A)),
                    LEITORES, as("07:16"), as("12:00"));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.DIVERGENTE);
        }

        @Test
        void chegadaDepoisDaJanelaResolveMasGuardaOHistorico() {
            JornadaDoDia jornada = montar("09:00",
                    leitura("07:00", LEITOR_ONIBUS_A),
                    leitura("07:55", LEITOR_ESCOLA));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.NA_ESCOLA);
            assertThat(jornada.tempoTrajetoMin()).isEqualTo(55L);
            assertThat(jornada.temDivergencia(TipoDivergencia.EMBARCOU_SEM_CHEGADA)).isTrue();
        }

        @Test
        void chegouSemEmbarqueEhInfoEConfirmaPresenca() {
            JornadaDoDia jornada = montar("08:00", leitura("07:30", LEITOR_ESCOLA));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.NA_ESCOLA);
            assertThat(jornada.tempoTrajetoMin()).isNull();
            assertThat(jornada.divergencias()).singleElement().satisfies(d -> {
                assertThat(d.tipo()).isEqualTo(TipoDivergencia.CHEGOU_SEM_EMBARQUE);
                assertThat(d.severidade()).isEqualTo(Severidade.INFO);
            });
        }

        @Test
        void doisEmbarquesNoDiaGeramEmbarqueDuplicadoUmaVez() {
            JornadaDoDia jornada = montar("07:30",
                    leitura("07:00", LEITOR_ONIBUS_A),
                    leitura("07:10", LEITOR_ONIBUS_B),
                    leitura("07:20", LEITOR_ONIBUS_A));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.EMBARCADO);
            assertThat(jornada.divergencias()).singleElement().satisfies(d -> {
                assertThat(d.tipo()).isEqualTo(TipoDivergencia.EMBARQUE_DUPLICADO);
                assertThat(d.severidade()).isEqualTo(Severidade.ATENCAO);
                assertThat(d.detectadaEm()).isEqualTo(as("07:10"));
            });
            assertThat(jornada.embarqueEm()).as("vale o primeiro embarque").isEqualTo(as("07:00"));
            assertThat(jornada.veiculoId()).isEqualTo(ONIBUS_A);
            assertThat(jornada.passos()).hasSize(3);
        }

        @Test
        void segundoEmbarqueDepoisDeDivergenteMantemDivergente() {
            JornadaDoDia jornada = montar("08:00",
                    leitura("07:00", LEITOR_ONIBUS_A),
                    leitura("07:50", LEITOR_ONIBUS_B));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.DIVERGENTE);
            assertThat(jornada.divergencias()).extracting(Divergencia::tipo)
                    .containsExactly(TipoDivergencia.EMBARCOU_SEM_CHEGADA, TipoDivergencia.EMBARQUE_DUPLICADO);
        }

        @Test
        void veiculoDiferenteDoCadastroNaoEhGeradoSemVeiculoEsperado() {
            JornadaDoDia jornada = montar("07:30",
                    leitura("07:00", LEITOR_ONIBUS_B),
                    leitura("07:20", LEITOR_ESCOLA));

            assertThat(jornada.temDivergencia(TipoDivergencia.VEICULO_DIFERENTE_DO_CADASTRO)).isFalse();
        }
    }

    @Nested
    class LeiturasIgnoradas {

        @Test
        void mesmoLeitorEmMenosDeDoisMinutosEhDuplicada() {
            JornadaDoDia jornada = montar("07:10",
                    leitura("07:00", LEITOR_ONIBUS_A),
                    leitura("07:00:30", LEITOR_ONIBUS_A),
                    leitura("07:01:59", LEITOR_ONIBUS_A));

            assertThat(jornada.leiturasIgnoradas().duplicadas()).isEqualTo(2);
            assertThat(jornada.divergencias()).as("duplicada não é segundo embarque").isEmpty();
            assertThat(jornada.passos()).hasSize(1);
        }

        @Test
        void mesmoLeitorComDoisMinutosOuMaisNaoEhDuplicada() {
            JornadaDoDia jornada = montar("07:10",
                    leitura("07:00", LEITOR_ONIBUS_A),
                    leitura("07:02", LEITOR_ONIBUS_A));

            assertThat(jornada.leiturasIgnoradas().duplicadas()).isZero();
            assertThat(jornada.temDivergencia(TipoDivergencia.EMBARQUE_DUPLICADO)).isTrue();
        }

        @Test
        void leitoresDiferentesNoMesmoMinutoNaoSaoDuplicados() {
            JornadaDoDia jornada = montar("07:10",
                    leitura("07:00", LEITOR_ONIBUS_A),
                    leitura("07:00:30", LEITOR_ESCOLA));

            assertThat(jornada.leiturasIgnoradas().duplicadas()).isZero();
            assertThat(jornada.estado()).isEqualTo(EstadoJornada.NA_ESCOLA);
        }

        @Test
        void embarqueDepoisDaChegadaEhForaDeOrdem() {
            JornadaDoDia jornada = montar("17:00",
                    leitura("07:00", LEITOR_ONIBUS_A),
                    leitura("07:25", LEITOR_ESCOLA),
                    leitura("16:00", LEITOR_ONIBUS_A));

            assertThat(jornada.estado()).isEqualTo(EstadoJornada.NA_ESCOLA);
            assertThat(jornada.leiturasIgnoradas().foraDeOrdem()).isEqualTo(1);
            assertThat(jornada.passos()).hasSize(2);
        }

        @Test
        void segundaChegadaEhForaDeOrdem() {
            JornadaDoDia jornada = montar("09:00",
                    leitura("07:25", LEITOR_ESCOLA),
                    leitura("08:30", LEITOR_ESCOLA));

            assertThat(jornada.chegadaEm()).isEqualTo(as("07:25"));
            assertThat(jornada.leiturasIgnoradas().foraDeOrdem()).isEqualTo(1);
            assertThat(jornada.leiturasIgnoradas().total()).isEqualTo(1);
        }

        @Test
        void leituraComLeitorNaoClassificadoEhErroDeQuemChama() {
            Leitura semLeitor = new Leitura(null, ALUNO, as("07:00"), 999, null);

            assertThatThrownBy(() -> montar("07:10", semLeitor)).isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void regrasRecusamJanelaZeradaOuIntervaloNegativo() {
        assertThatThrownBy(() -> new RegrasJornada(Duration.ZERO, Duration.ofMinutes(2)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new RegrasJornada(Duration.ofMinutes(40), Duration.ofMinutes(-1)))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
