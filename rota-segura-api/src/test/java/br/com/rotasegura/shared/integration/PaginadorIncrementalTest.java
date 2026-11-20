package br.com.rotasegura.shared.integration;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.function.IntFunction;
import org.junit.jupiter.api.Test;

/** Recurso fictício com 2 itens por página que só cresce no fim, como a presença. */
class PaginadorIncrementalTest {

    private static final int POR_PAGINA = 2;
    private static final Instant T0 = Instant.parse("2026-03-10T11:00:00Z");

    private final List<String> registros = new ArrayList<>(List.of("r1", "r2", "r3", "r4", "r5"));
    private final List<Integer> pedidas = new ArrayList<>();
    private final PaginadorIncremental<String> paginador = new PaginadorIncremental<>(Duration.ofMinutes(30));

    private final IntFunction<PaginaApi<String>> api = pagina -> {
        pedidas.add(pagina);
        int ultima = Math.max(1, (registros.size() + POR_PAGINA - 1) / POR_PAGINA);
        int de = (pagina - 1) * POR_PAGINA;
        List<String> itens = de >= registros.size()
                ? List.of()
                : List.copyOf(registros.subList(de, Math.min(de + POR_PAGINA, registros.size())));
        return new PaginaApi<>(itens, new Meta(registros.size(), POR_PAGINA, pagina, ultima));
    };

    @Test
    void primeiraLeituraECompletaEAsSeguintesSoRelemAsUltimasPaginas() {
        assertThat(paginador.atualizar(api, 50, T0).itens()).containsExactly("r1", "r2", "r3", "r4", "r5");
        assertThat(pedidas).containsExactly(1, 2, 3);
        assertThat(paginador.paginasFechadas()).isEqualTo(2);

        registros.addAll(List.of("r6", "r7"));
        pedidas.clear();
        ColecaoPaginada<String> depois = paginador.atualizar(api, 50, T0.plusSeconds(30));

        assertThat(pedidas).as("só a página aberta e a nova").containsExactly(3, 4);
        assertThat(depois.itens()).containsExactly("r1", "r2", "r3", "r4", "r5", "r6", "r7");
        assertThat(depois.truncada()).isFalse();
    }

    @Test
    void registroApagadoNoMeioFazReleituraCompletaNaHora() {
        paginador.atualizar(api, 50, T0);
        registros.remove("r2");
        pedidas.clear();

        ColecaoPaginada<String> depois = paginador.atualizar(api, 50, T0.plusSeconds(30));

        assertThat(depois.itens()).containsExactly("r1", "r3", "r4", "r5");
        assertThat(pedidas).as("tentou do ponto guardado e recomeçou do zero").startsWith(3).contains(1);
    }

    @Test
    void paginaSeguinteAsFechadasSumindoTambemRecomeca() {
        paginador.atualizar(api, 50, T0);
        registros.subList(2, 5).clear();

        assertThat(paginador.atualizar(api, 50, T0.plusSeconds(30)).itens()).containsExactly("r1", "r2");
    }

    @Test
    void depoisDoIntervaloReleTudoParaPegarCorrecoesEmPaginasAntigas() {
        paginador.atualizar(api, 50, T0);
        registros.set(0, "r1-corrigido");
        pedidas.clear();

        assertThat(paginador.atualizar(api, 50, T0.plusSeconds(60)).itens()).first().isEqualTo("r1");
        assertThat(paginador.atualizar(api, 50, T0.plus(Duration.ofMinutes(31))).itens()).first()
                .isEqualTo("r1-corrigido");
    }

    @Test
    void limiteDePaginasTruncaEAProximaRodadaContinuaDeOndeParou() {
        ColecaoPaginada<String> primeira = paginador.atualizar(api, 2, T0);
        assertThat(primeira.truncada()).isTrue();
        assertThat(primeira.itens()).containsExactly("r1", "r2", "r3", "r4");

        ColecaoPaginada<String> segunda = paginador.atualizar(api, 2, T0.plusSeconds(30));
        assertThat(segunda.truncada()).isFalse();
        assertThat(segunda.itens()).containsExactly("r1", "r2", "r3", "r4", "r5");
    }
}
