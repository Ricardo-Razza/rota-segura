package br.com.rotasegura.presenca.application;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class PresencaUnidadeTest {

    @Test
    void fimDeSemanaEDiasSemAulaNaoSaoLetivos() {
        CalendarioLetivo calendario = new CalendarioLetivo(
                new CalendarioLetivo.Propriedades(List.of(LocalDate.of(2026, 4, 21))));

        assertThat(calendario.ehLetivo(LocalDate.of(2026, 3, 9))).as("segunda").isTrue();
        assertThat(calendario.ehLetivo(LocalDate.of(2026, 3, 14))).as("sábado").isFalse();
        assertThat(calendario.ehLetivo(LocalDate.of(2026, 3, 15))).as("domingo").isFalse();
        assertThat(calendario.ehLetivo(LocalDate.of(2026, 4, 21))).as("feriado configurado").isFalse();
        assertThat(new CalendarioLetivo(new CalendarioLetivo.Propriedades(null))
                .ehLetivo(LocalDate.of(2026, 4, 21))).isTrue();
    }

    @Test
    void percentualComUmaCasaENuloSemBase() {
        assertThat(PresencaService.percentual(2, 3)).isEqualByComparingTo(new BigDecimal("66.7"));
        assertThat(PresencaService.percentual(5, 5)).isEqualByComparingTo(new BigDecimal("100"));
        assertThat(PresencaService.percentual(0, 0)).isNull();
    }
}
