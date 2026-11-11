package br.com.rotasegura.auth.application;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotasegura.auth.application.AuthExceptions.MuitasTentativasException;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

class LimitadorDeLoginTest {

    private final LimitadorDeLogin limitador = new LimitadorDeLogin(new AuthProperties(
            "segredo-ficticio-somente-para-testes-0123456789", Duration.ofMinutes(15), Duration.ofDays(7), true,
            List.of("http://localhost:4200"), 3, Duration.ofMinutes(1), null, null));

    @Test
    void bloqueiaAoAtingirOMaximoDeFalhas() {
        limitador.registrarFalha("ip|a");
        limitador.registrarFalha("ip|a");
        assertThatCode(() -> limitador.verificar("ip|a")).doesNotThrowAnyException();

        limitador.registrarFalha("ip|a");

        assertThatThrownBy(() -> limitador.verificar("ip|a")).isInstanceOf(MuitasTentativasException.class);
        assertThatCode(() -> limitador.verificar("ip|b")).doesNotThrowAnyException();
    }

    @Test
    void sucessoZeraAContagem() {
        limitador.registrarFalha("ip|a");
        limitador.registrarFalha("ip|a");
        limitador.registrarSucesso("ip|a");
        limitador.registrarFalha("ip|a");

        assertThatCode(() -> limitador.verificar("ip|a")).doesNotThrowAnyException();
    }
}
