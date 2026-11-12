package br.com.rotasegura.shared.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotasegura.shared.erro.RequisicaoInvalidaException;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

class PaginaEPeriodoTest {

    private final List<Integer> cento = IntStream.rangeClosed(1, 100).boxed().toList();

    @Test
    void recortaAPaginaPedida() {
        Pagina<Integer> pagina = Pagina.de(cento, 2, 30);

        assertThat(pagina.itens()).containsExactlyElementsOf(cento.subList(30, 60));
        assertThat(pagina.total()).isEqualTo(100);
        assertThat(pagina.totalPaginas()).isEqualTo(4);
    }

    @Test
    void usaOPadraoEDevolvePaginaVaziaAlemDoFim() {
        assertThat(Pagina.de(cento, null, null).itens()).hasSize(Pagina.TAMANHO_PADRAO);
        assertThat(Pagina.de(cento, 9, 30).itens()).isEmpty();
        assertThat(Pagina.de(List.of(), 1, 10).totalPaginas()).isZero();
    }

    @Test
    void recusaPaginaOuTamanhoInvalidos() {
        assertThatThrownBy(() -> Pagina.de(cento, 0, 10)).isInstanceOf(RequisicaoInvalidaException.class);
        assertThatThrownBy(() -> Pagina.de(cento, 1, 0)).isInstanceOf(RequisicaoInvalidaException.class);
        assertThatThrownBy(() -> Pagina.de(cento, 1, Pagina.TAMANHO_MAXIMO + 1))
                .isInstanceOf(RequisicaoInvalidaException.class);
    }

    @Test
    void mapearMantemOsMetadados() {
        Pagina<String> texto = Pagina.de(cento, 3, 10).mapear(String::valueOf);

        assertThat(texto.itens()).first().isEqualTo("21");
        assertThat(texto.pagina()).isEqualTo(3);
        assertThat(texto.total()).isEqualTo(100);
    }

    @Test
    void periodoListaOsDiasInclusive() {
        Periodo periodo = Periodo.validar(LocalDate.of(2026, 3, 9), LocalDate.of(2026, 3, 11), 31);

        assertThat(periodo.dias()).containsExactly(LocalDate.of(2026, 3, 9), LocalDate.of(2026, 3, 10),
                LocalDate.of(2026, 3, 11));
    }

    @Test
    void periodoRecusaInvertidoLongoOuIncompleto() {
        LocalDate dia = LocalDate.of(2026, 3, 10);
        assertThatThrownBy(() -> Periodo.validar(dia, dia.minusDays(1), 31))
                .isInstanceOf(RequisicaoInvalidaException.class);
        assertThatThrownBy(() -> Periodo.validar(dia, dia.plusDays(31), 31))
                .isInstanceOf(RequisicaoInvalidaException.class);
        assertThatThrownBy(() -> Periodo.validar(null, dia, 31)).isInstanceOf(RequisicaoInvalidaException.class);
        assertThat(Periodo.validar(dia, dia.plusDays(30), 31).dias()).hasSize(31);
    }
}
