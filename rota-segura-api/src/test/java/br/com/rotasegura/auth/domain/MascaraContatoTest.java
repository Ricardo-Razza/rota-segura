package br.com.rotasegura.auth.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Contatos fictícios. */
class MascaraContatoTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "ficticio@exemplo.com | f*******@exemplo.com",
            "a@exemplo.com | a@exemplo.com",
            "(00) 90000-1234 | (**) *****-1234",
            "00900001234 | *******1234",
            "1234 | 1234",
    })
    void mascaraEmailETelefone(String contato, String esperado) {
        assertThat(MascaraContato.mascarar(contato)).isEqualTo(esperado);
    }

    @Test
    void nuloEVazioViramTextoVazio() {
        assertThat(MascaraContato.mascarar(null)).isEmpty();
        assertThat(MascaraContato.mascarar("  ")).isEmpty();
    }
}
