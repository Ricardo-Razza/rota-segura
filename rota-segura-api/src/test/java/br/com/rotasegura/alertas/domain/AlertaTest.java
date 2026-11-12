package br.com.rotasegura.alertas.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotasegura.jornada.domain.Severidade;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** Deduplicação e ciclo de vida do alerta. Dados fictícios. */
class AlertaTest {

    private static final Instant T0 = Instant.parse("2026-03-10T10:00:00Z");

    private static Ocorrencia lotacao(Severidade severidade, String texto) {
        return new Ocorrencia(TipoAlerta.LOTACAO, severidade, EntidadeAlerta.VEICULO, "7", "AAA0A00", "2026-03-10",
                texto, 50L, 7L);
    }

    @Test
    void chaveEhTipoEntidadeEJanela() {
        assertThat(lotacao(Severidade.ATENCAO, "x").chave()).isEqualTo("LOTACAO:VEICULO:7:2026-03-10");
    }

    @Test
    void mesmaCondicaoPersistindoNaoSomaOcorrencia() {
        Alerta alerta = Alerta.abrir(lotacao(Severidade.ATENCAO, "92%"), T0);

        assertThat(alerta.registrar(lotacao(Severidade.ATENCAO, "92%"), T0.plusSeconds(30))).isFalse();
        assertThat(alerta.getOcorrencias()).isEqualTo(1);
    }

    @Test
    void condicaoQueVoltaSomaOcorrenciaEAtualizaUltimaHora() {
        Alerta alerta = Alerta.abrir(lotacao(Severidade.ATENCAO, "92%"), T0);
        alerta.cessar();

        assertThat(alerta.registrar(lotacao(Severidade.ATENCAO, "92%"), T0.plusSeconds(600))).isTrue();
        assertThat(alerta.getOcorrencias()).isEqualTo(2);
        assertThat(alerta.getUltimaOcorrenciaEm()).isEqualTo(T0.plusSeconds(600));
        assertThat(alerta.getPrimeiraOcorrenciaEm()).isEqualTo(T0);
    }

    @Test
    void severidadeQueSobeAtualizaOMesmoAlerta() {
        Alerta alerta = Alerta.abrir(lotacao(Severidade.ATENCAO, "92%"), T0);

        assertThat(alerta.registrar(lotacao(Severidade.CRITICO, "110%"), T0.plusSeconds(30))).isTrue();
        assertThat(alerta.getSeveridade()).isEqualTo(Severidade.CRITICO);
        assertThat(alerta.getMensagem()).isEqualTo("110%");
    }

    @Test
    void resolvidoNaoReabreNaMesmaJanela() {
        Alerta alerta = Alerta.abrir(lotacao(Severidade.ATENCAO, "92%"), T0);
        alerta.resolver(1L, "Remanejados dois alunos.", T0.plusSeconds(60));
        alerta.cessar();

        assertThat(alerta.registrar(lotacao(Severidade.CRITICO, "110%"), T0.plusSeconds(90))).isFalse();
        assertThat(alerta.getStatus()).isEqualTo(StatusAlerta.RESOLVIDO);
        assertThat(alerta.getComentario()).isEqualTo("Remanejados dois alunos.");
    }

    @Test
    void transicoesValidas() {
        assertThat(StatusAlerta.ABERTO.podeIrPara(StatusAlerta.EM_ANALISE)).isTrue();
        assertThat(StatusAlerta.ABERTO.podeIrPara(StatusAlerta.RESOLVIDO)).isTrue();
        assertThat(StatusAlerta.EM_ANALISE.podeIrPara(StatusAlerta.RESOLVIDO)).isTrue();
        assertThat(StatusAlerta.EM_ANALISE.podeIrPara(StatusAlerta.ABERTO)).isFalse();
        assertThat(StatusAlerta.RESOLVIDO.podeIrPara(StatusAlerta.ABERTO)).isFalse();

        Alerta alerta = Alerta.abrir(lotacao(Severidade.ATENCAO, "92%"), T0);
        assertThatThrownBy(() -> alerta.resolver(1L, " ", T0)).isInstanceOf(IllegalArgumentException.class);
        alerta.assumir(1L, T0);
        assertThatThrownBy(() -> alerta.assumir(2L, T0)).isInstanceOf(IllegalStateException.class);
    }
}
