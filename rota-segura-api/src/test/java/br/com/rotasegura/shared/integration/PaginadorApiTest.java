package br.com.rotasegura.shared.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class PaginadorApiTest {

    @Test
    void leAteAUltimaPagina() {
        List<Integer> pedidas = new ArrayList<>();

        var resultado = PaginadorApi.buscarTodas(pagina -> {
            pedidas.add(pagina);
            return new PaginaApi<>(List.of("item-" + pagina), new Meta(3, 1, pagina, 3));
        }, 50);

        assertThat(pedidas).containsExactly(1, 2, 3);
        assertThat(resultado.itens()).containsExactly("item-1", "item-2", "item-3");
        assertThat(resultado.truncada()).isFalse();
    }

    @Test
    void paraQuandoAPaginaVemVazia() {
        var resultado = PaginadorApi.buscarTodas(pagina -> pagina == 1
                ? new PaginaApi<>(List.of("a"), new Meta(99, 1, 1, 99))
                : new PaginaApi<String>(List.of(), new Meta(99, 1, pagina, 99)), 50);

        assertThat(resultado.itens()).containsExactly("a");
        assertThat(resultado.paginasLidas()).isEqualTo(1);
        assertThat(resultado.truncada()).isFalse();
    }

    @Test
    void semMetaLeSoAPrimeiraPagina() {
        var resultado = PaginadorApi.buscarTodas(pagina -> new PaginaApi<>(List.of("a"), null), 50);

        assertThat(resultado.itens()).containsExactly("a");
        assertThat(resultado.paginasLidas()).isEqualTo(1);
    }

    @Test
    void marcaTruncadaAoAtingirOLimite() {
        var resultado = PaginadorApi.buscarTodas(
                pagina -> new PaginaApi<>(List.of(pagina), new Meta(100, 1, pagina, 100)), 4);

        assertThat(resultado.itens()).containsExactly(1, 2, 3, 4);
        assertThat(resultado.truncada()).isTrue();
    }

    @Test
    void respostaNulaEDataNulaNaoQuebram() {
        assertThat(PaginadorApi.buscarTodas(pagina -> (PaginaApi<String>) null, 5).itens()).isEmpty();
        assertThat(new PaginaApi<String>(null, null).data()).isEmpty();
    }

    @Test
    void limiteInvalidoEhRecusado() {
        assertThatThrownBy(() -> PaginadorApi.buscarTodas(p -> new PaginaApi<String>(List.of(), null), 0))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
