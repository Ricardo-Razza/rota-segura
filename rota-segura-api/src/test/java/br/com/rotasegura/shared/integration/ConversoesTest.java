package br.com.rotasegura.shared.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

class ConversoesTest {

    private static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");

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

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "  ", "ontem", "2026-13-40 07:00", "07:00", "2026-03-10"})
    void paraDataHoraDevolveNuloParaEntradaInvalida(String texto) {
        assertThat(Conversoes.paraDataHora(texto, ZONA)).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "2026-03-10 07:42:10",
            "2026-03-10T07:42:10",
            "2026-03-10T07:42:10.000",
            " 2026-03-10 07:42:10 ",
            "2026-03-10T10:42:10Z",
            "2026-03-10T07:42:10-03:00",
            "10/03/2026 07:42:10"})
    void paraDataHoraAceitaOsFormatosComunsEConverteParaAZona(String texto) {
        assertThat(Conversoes.paraDataHora(texto, ZONA)).isEqualTo(LocalDateTime.of(2026, 3, 10, 7, 42, 10));
    }

    @Test
    void paraDataHoraSemSegundos() {
        assertThat(Conversoes.paraDataHora("2026-03-10 07:42", ZONA)).isEqualTo(LocalDateTime.of(2026, 3, 10, 7, 42));
        assertThat(Conversoes.paraDataHora("10/03/2026 07:42", ZONA)).isEqualTo(LocalDateTime.of(2026, 3, 10, 7, 42));
    }

    @Test
    void paraDoubleAceitaPontoEVirgula() {
        assertThat(Conversoes.paraDouble("-10.5")).isEqualTo(-10.5);
        assertThat(Conversoes.paraDouble("-50,25")).isEqualTo(-50.25);
    }
}
