package br.com.rotasegura.jornada.domain;

import static br.com.rotasegura.jornada.domain.EstadoJornada.AGUARDANDO;
import static br.com.rotasegura.jornada.domain.EstadoJornada.AUSENTE;
import static br.com.rotasegura.jornada.domain.EstadoJornada.DIVERGENTE;
import static br.com.rotasegura.jornada.domain.EstadoJornada.EMBARCADO;
import static br.com.rotasegura.jornada.domain.EstadoJornada.NA_ESCOLA;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Tabela de transições da máquina de estados, explícita para qualquer mudança quebrar o teste. */
class EstadoJornadaTest {

    @Test
    void aguardandoPodeEmbarcarChegarOuFicarAusente() {
        assertThat(AGUARDANDO.proximosValidos()).containsExactlyInAnyOrder(EMBARCADO, NA_ESCOLA, AUSENTE);
    }

    @Test
    void embarcadoPodeChegarDivergirOuEmbarcarDeNovo() {
        assertThat(EMBARCADO.proximosValidos()).containsExactlyInAnyOrder(EMBARCADO, NA_ESCOLA, DIVERGENTE);
    }

    @Test
    void divergenteSoResolveComChegadaOuSegueDivergente() {
        assertThat(DIVERGENTE.proximosValidos()).containsExactlyInAnyOrder(DIVERGENTE, NA_ESCOLA);
    }

    @Test
    void ausenteAindaPodeEmbarcarOuChegarAtrasado() {
        assertThat(AUSENTE.proximosValidos()).containsExactlyInAnyOrder(EMBARCADO, NA_ESCOLA);
    }

    @Test
    void naEscolaEhFinal() {
        assertThat(NA_ESCOLA.proximosValidos()).isEmpty();
        for (EstadoJornada destino : EstadoJornada.values()) {
            assertThat(NA_ESCOLA.podeIrPara(destino)).isFalse();
        }
    }

    @Test
    void ninguemVoltaParaAguardando() {
        for (EstadoJornada origem : EstadoJornada.values()) {
            assertThat(origem.podeIrPara(AGUARDANDO)).as(origem.name()).isFalse();
        }
    }

    @Test
    void severidadesDasDivergenciasSeguemOClaudeMd() {
        assertThat(TipoDivergencia.EMBARCOU_SEM_CHEGADA.severidade()).isEqualTo(Severidade.CRITICO);
        assertThat(TipoDivergencia.CHEGOU_SEM_EMBARQUE.severidade()).isEqualTo(Severidade.INFO);
        assertThat(TipoDivergencia.VEICULO_DIFERENTE_DO_CADASTRO.severidade()).isEqualTo(Severidade.ATENCAO);
        assertThat(TipoDivergencia.EMBARQUE_DUPLICADO.severidade()).isEqualTo(Severidade.ATENCAO);
    }
}
