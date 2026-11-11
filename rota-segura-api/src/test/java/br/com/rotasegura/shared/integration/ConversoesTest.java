package br.com.rotasegura.shared.integration;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

class ConversoesTest {

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   ", "abc", "1.5", "12x"})
    void paraLongDevolveNuloParaEntradaInvalida(String texto) {
        assertThat(Conversoes.paraLong(texto)).isNull();
    }

    @Test
    void paraLongConverteTextoNumerico() {
        assertThat(Conversoes.paraLong("42")).isEqualTo(42L);
        assertThat(Conversoes.paraLong(" 7 ")).isEqualTo(7L);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", "norte", "NaN", "Infinity"})
    void paraDoubleDevolveNuloParaEntradaInvalida(String texto) {
        assertThat(Conversoes.paraDouble(texto)).isNull();
    }

    @Test
    void paraDoubleAceitaPontoEVirgula() {
        assertThat(Conversoes.paraDouble("-10.5")).isEqualTo(-10.5);
        assertThat(Conversoes.paraDouble("-50,25")).isEqualTo(-50.25);
    }
}
