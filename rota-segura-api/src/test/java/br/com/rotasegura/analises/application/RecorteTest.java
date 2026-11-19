package br.com.rotasegura.analises.application;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotasegura.analises.application.Recorte.Granularidade;
import br.com.rotasegura.shared.application.Periodo;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class RecorteTest {

    private static Periodo de(String inicio, String fim) {
        return new Periodo(LocalDate.parse(inicio), LocalDate.parse(fim));
    }

    @Test
    void granularidadeAcompanhaOTamanhoDoPeriodo() {
        assertThat(new Recorte(de("2026-03-01", "2026-03-31")).granularidade()).isEqualTo(Granularidade.DIA);
        assertThat(new Recorte(de("2026-01-01", "2026-04-30")).granularidade()).isEqualTo(Granularidade.SEMANA);
        assertThat(new Recorte(de("2026-01-01", "2026-12-31")).granularidade()).isEqualTo(Granularidade.MES);
    }

    @Test
    void semanaNaoComecaAntesDoPeriodo() {
        // 04/03/2026 é quarta: o primeiro grupo começa no próprio dia 04, o segundo na segunda 09.
        Recorte r = new Recorte(de("2026-03-04", "2026-03-20"), Granularidade.SEMANA);
        assertThat(r.grupos()).containsExactly(LocalDate.parse("2026-03-04"), LocalDate.parse("2026-03-09"),
                LocalDate.parse("2026-03-16"));
        assertThat(r.indice(LocalDate.parse("2026-03-08"))).isZero();
        assertThat(r.indice(LocalDate.parse("2026-03-10"))).isEqualTo(1);
        assertThat(r.indice(LocalDate.parse("2026-03-21"))).isEqualTo(-1);
    }

    @Test
    void periodosDeComparacao() {
        Periodo semana = de("2026-03-09", "2026-03-13");
        assertThat(Comparacao.PERIODO_ANTERIOR.referencia(semana)).isEqualTo(de("2026-03-04", "2026-03-08"));
        assertThat(Comparacao.ANO_ANTERIOR.referencia(semana)).isEqualTo(de("2025-03-09", "2025-03-13"));
        assertThat(Comparacao.NENHUMA.referencia(semana)).isNull();
    }

    @Test
    void variacoesSemBaseFicamNulas() {
        assertThat(AnalisesService.variacao(12, 10)).isEqualByComparingTo("20.0");
        assertThat(AnalisesService.variacao(5, 0)).isNull();
        assertThat(AnalisesService.diferenca(null, java.math.BigDecimal.TEN)).isNull();
    }
}
