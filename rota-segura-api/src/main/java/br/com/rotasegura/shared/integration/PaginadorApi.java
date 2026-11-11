package br.com.rotasegura.shared.integration;

import java.util.ArrayList;
import java.util.List;
import java.util.function.IntFunction;

/** Percorre as páginas de um recurso da API externa até {@code last_page} ou até o limite. */
public final class PaginadorApi {

    private PaginadorApi() {
    }

    /**
     * @param buscarPagina função que busca uma página (a primeira é 1)
     * @param maxPaginas   limite de páginas lidas; se atingido, o resultado vem marcado como truncado
     */
    public static <T> ColecaoPaginada<T> buscarTodas(IntFunction<PaginaApi<T>> buscarPagina, int maxPaginas) {
        if (maxPaginas < 1) {
            throw new IllegalArgumentException("maxPaginas deve ser >= 1");
        }
        List<T> itens = new ArrayList<>();
        int pagina = 1;
        while (true) {
            PaginaApi<T> resposta = buscarPagina.apply(pagina);
            if (resposta == null || resposta.data().isEmpty()) {
                return new ColecaoPaginada<>(itens, pagina - 1, false);
            }
            itens.addAll(resposta.data());
            if (ultimaPagina(resposta.meta(), pagina)) {
                return new ColecaoPaginada<>(itens, pagina, false);
            }
            if (pagina >= maxPaginas) {
                return new ColecaoPaginada<>(itens, pagina, true);
            }
            pagina++;
        }
    }

    private static boolean ultimaPagina(Meta meta, int paginaAtual) {
        // Sem meta confiável não dá para saber se há mais páginas: para aqui em vez de adivinhar.
        return meta == null || meta.lastPage() == null || paginaAtual >= meta.lastPage();
    }
}
