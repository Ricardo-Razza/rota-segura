package br.com.rotasegura.veiculos.domain;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotasegura.veiculos.domain.RastroDoDia.PontoRastro;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

/** Onde o ônibus estava na hora do embarque. Coordenadas fictícias (0,001° de latitude ≈ 111 m). */
class PontoNoMomentoTest {

    private static final LocalDateTime EMBARQUE = LocalDateTime.of(2026, 3, 10, 7, 0);

    private static PontoRastro ponto(double latitude, int hora, int minuto) {
        return new PontoRastro(latitude, -50.0, LocalDateTime.of(2026, 3, 10, hora, minuto));
    }

    @Test
    void ultimoPontoRecenteValeSozinho() {
        PontoRastro antes = ponto(-10.01, 6, 59);
        assertThat(PontoNoMomento.escolher(EMBARQUE, antes, null)).contains(antes);
    }

    @Test
    void paradaLongaValeQuandoOOnibusSaiDePerto() {
        PontoRastro chegouNoPonto = ponto(-10.01, 6, 50);
        PontoRastro saiu = ponto(-10.0102, 7, 3);
        assertThat(PontoNoMomento.escolher(EMBARQUE, chegouNoPonto, saiu)).contains(chegouNoPonto);
    }

    @Test
    void pontoAntigoSemConfirmacaoNaoVale() {
        // Rastreador sem sinal: o último ponto é de 10 min antes e o seguinte está a ~1 km.
        PontoRastro antigo = ponto(-10.01, 6, 50);
        PontoRastro longe = ponto(-10.02, 7, 10);
        assertThat(PontoNoMomento.escolher(EMBARQUE, antigo, longe)).isEmpty();
        assertThat(PontoNoMomento.escolher(EMBARQUE, antigo, null)).isEmpty();
    }

    @Test
    void semPontoAntesUsaOSeguinteSeForLogoDepois() {
        PontoRastro logoDepois = ponto(-10.01, 7, 1);
        assertThat(PontoNoMomento.escolher(EMBARQUE, null, logoDepois)).contains(logoDepois);
        assertThat(PontoNoMomento.escolher(EMBARQUE, null, ponto(-10.01, 7, 5))).isEmpty();
        assertThat(PontoNoMomento.escolher(EMBARQUE, null, null)).isEmpty();
    }
}
