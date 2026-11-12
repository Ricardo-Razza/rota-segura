package br.com.rotasegura.dashboard.domain;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotasegura.dashboard.domain.SupressaoPequenosGrupos.Grupo;
import br.com.rotasegura.veiculos.domain.FaixaOcupacao;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RegrasDeFaixaTest {

    @Test
    void faixaDeOcupacao() {
        assertThat(FaixaOcupacao.de(null, 90, 100)).isNull();
        assertThat(FaixaOcupacao.de(new BigDecimal("90"), 90, 100)).isEqualTo(FaixaOcupacao.OK);
        assertThat(FaixaOcupacao.de(new BigDecimal("90.1"), 90, 100)).isEqualTo(FaixaOcupacao.ATENCAO);
        assertThat(FaixaOcupacao.de(new BigDecimal("95"), 90, 100))
                .as("95% de lotação nunca passa sem alerta").isEqualTo(FaixaOcupacao.ATENCAO);
        assertThat(FaixaOcupacao.de(new BigDecimal("100"), 90, 100)).isEqualTo(FaixaOcupacao.ATENCAO);
        assertThat(FaixaOcupacao.de(new BigDecimal("100.1"), 90, 100)).isEqualTo(FaixaOcupacao.CRITICO);
    }

    @Test
    void faixaDeFrequencia() {
        assertThat(FaixaFrequencia.de(null)).isNull();
        assertThat(FaixaFrequencia.de(new BigDecimal("59.9"))).isEqualTo(FaixaFrequencia.CRITICO);
        assertThat(FaixaFrequencia.de(new BigDecimal("60"))).isEqualTo(FaixaFrequencia.ATENCAO);
        assertThat(FaixaFrequencia.de(new BigDecimal("85"))).isEqualTo(FaixaFrequencia.ATENCAO);
        assertThat(FaixaFrequencia.de(new BigDecimal("85.1"))).isEqualTo(FaixaFrequencia.OK);
    }

    @Test
    void suprimeGruposPequenosSemDeixarDeduzirPeloTotal() {
        Map<String, Long> contagem = new LinkedHashMap<>();
        contagem.put("A", 40L);
        contagem.put("B", 12L);
        contagem.put("C", 3L);

        List<Grupo> grupos = SupressaoPequenosGrupos.aplicar(contagem, 5);

        assertThat(grupos).extracting(Grupo::rotulo).containsExactly("A", "B", "C");
        assertThat(grupos.get(0).quantidade()).isEqualTo(40L);
        assertThat(grupos.get(1).suprimido()).as("supressão complementar: o menor restante").isTrue();
        assertThat(grupos.get(2).suprimido()).isTrue();
        assertThat(grupos).allSatisfy(g -> {
            if (g.suprimido()) {
                assertThat(g.quantidade()).isNull();
                assertThat(g.quantidadeReal()).isNull();
            }
        });
    }

    @Test
    void doisGruposPequenosJaSeProtegem() {
        List<Grupo> grupos = SupressaoPequenosGrupos.aplicar(Map.of("A", 40L, "B", 4L, "C", 2L), 5);

        assertThat(grupos).filteredOn(Grupo::suprimido).extracting(Grupo::rotulo).containsExactly("B", "C");
        assertThat(grupos.getFirst().quantidade()).isEqualTo(40L);
    }
}
