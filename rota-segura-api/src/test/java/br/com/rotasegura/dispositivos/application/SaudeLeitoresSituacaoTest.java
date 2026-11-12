package br.com.rotasegura.dispositivos.application;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotasegura.dispositivos.application.SaudeLeitoresService.Situacao;
import java.time.Duration;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

class SaudeLeitoresSituacaoTest {

    private final SaudeLeitoresService servico = new SaudeLeitoresService(null, null, null,
            new SaudeLeitoresService.Propriedades(Duration.ofMinutes(30)));
    private final LocalDateTime agora = LocalDateTime.of(2026, 3, 10, 8, 0);

    @Test
    void onlineAteOLimiteOfflineDepoisESemLeituraQuandoNuncaLeu() {
        assertThat(servico.situacao(agora.minusMinutes(30), agora)).isEqualTo(Situacao.ONLINE);
        assertThat(servico.situacao(agora.minusMinutes(31), agora)).isEqualTo(Situacao.OFFLINE);
        assertThat(servico.situacao(null, agora)).isEqualTo(Situacao.SEM_LEITURA);
    }
}
