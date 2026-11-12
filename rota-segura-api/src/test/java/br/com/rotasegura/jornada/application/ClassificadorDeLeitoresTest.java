package br.com.rotasegura.jornada.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.jornada.application.ClassificadorDeLeitores.Classificacao;
import br.com.rotasegura.jornada.domain.Leitor;
import br.com.rotasegura.jornada.domain.TipoLeitor;
import java.time.Duration;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ClassificadorDeLeitoresTest {

    private static JornadaProperties propriedades(List<String> embarque, List<String> chegada) {
        return new JornadaProperties(ZoneId.of("America/Sao_Paulo"), Duration.ofMinutes(40), Duration.ofMinutes(2),
                LocalTime.NOON, Map.of(), new JornadaProperties.TiposLeitor(embarque, chegada));
    }

    private static DispositivoFacialDto dispositivo(String id, String tipo, String veiculoId, String escolaId) {
        return new DispositivoFacialDto(id, "Leitor fictício", veiculoId, null, null, null, tipo, null, null, null, escolaId);
    }

    private final ClassificadorDeLeitores classificador =
            new ClassificadorDeLeitores(propriedades(List.of("1"), List.of("2")));

    @Test
    void classificaPeloTipoDeUsoMapeado() {
        Classificacao resultado = classificador.classificar(List.of(
                dispositivo("11", "1", "7", "50"),
                dispositivo("21", " 2 ", "", "50")));

        assertThat(resultado.leitores()).containsOnly(
                Map.entry(11L, new Leitor(11, TipoLeitor.EMBARQUE, 7L, 50L)),
                Map.entry(21L, new Leitor(21, TipoLeitor.CHEGADA, null, 50L)));
        assertThat(resultado.tipoDesconhecido()).isEmpty();
    }

    @Test
    void tipoNaoMapeadoNuncaEhClassificadoPorPalpite() {
        Classificacao resultado = classificador.classificar(List.of(
                dispositivo("31", "3", "7", "50"),
                dispositivo("32", "", "7", "50"),
                dispositivo("33", null, "7", "50"),
                dispositivo("34", "VEICULAR", "7", "50")));

        assertThat(resultado.leitores()).isEmpty();
        assertThat(resultado.tipoDesconhecido()).containsExactlyInAnyOrder(31L, 32L, 33L, 34L);
    }

    @Test
    void dispositivoSemIdNumericoEhContadoEDescartado() {
        Classificacao resultado = classificador.classificar(List.of(dispositivo("abc", "1", "7", "50"),
                dispositivo(null, "2", null, "50")));

        assertThat(resultado.leitores()).isEmpty();
        assertThat(resultado.semId()).isEqualTo(2);
    }

    @Test
    void mapeamentoVemDaConfiguracao() {
        ClassificadorDeLeitores outro = new ClassificadorDeLeitores(propriedades(List.of("5", "6"), List.of("8")));

        assertThat(outro.tipoDe("6")).isEqualTo(TipoLeitor.EMBARQUE);
        assertThat(outro.tipoDe("8")).isEqualTo(TipoLeitor.CHEGADA);
        assertThat(outro.tipoDe("1")).isNull();
    }

    @Test
    void mesmoTipoComoEmbarqueEChegadaEhErroDeConfiguracao() {
        assertThatThrownBy(() -> new JornadaProperties.TiposLeitor(List.of("1", "2"), List.of("2")))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("2");
    }

    @Test
    void limiteDeAusenciaPorTurnoIgnoraAcentoEMaiusculas() {
        JornadaProperties props = new JornadaProperties(ZoneId.of("America/Sao_Paulo"), Duration.ofMinutes(40),
                Duration.ofMinutes(2), LocalTime.NOON, Map.of("INTEGRAL", LocalTime.of(9, 0), "Vespertino", LocalTime.of(17, 0)),
                new JornadaProperties.TiposLeitor(List.of("1"), List.of("2")));

        assertThat(props.limiteAusenciaDoTurno("vespertino")).isEqualTo(LocalTime.of(17, 0));
        assertThat(props.limiteAusenciaDoTurno(" Íntegral ")).isEqualTo(LocalTime.of(9, 0));
        assertThat(props.limiteAusenciaDoTurno("Noturno")).isEqualTo(LocalTime.NOON);
        assertThat(props.limiteAusenciaDoTurno(null)).isEqualTo(LocalTime.NOON);
    }

    @Test
    void regrasInvalidasFalhamNaSubida() {
        assertThatThrownBy(() -> new JornadaProperties(ZoneId.of("America/Sao_Paulo"), Duration.ZERO,
                Duration.ofMinutes(2), LocalTime.NOON, null, new JornadaProperties.TiposLeitor(List.of("1"), List.of("2"))))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
