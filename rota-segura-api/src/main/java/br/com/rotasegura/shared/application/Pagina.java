package br.com.rotasegura.shared.application;

import br.com.rotasegura.shared.erro.RequisicaoInvalidaException;
import java.util.List;
import java.util.function.Function;

/**
 * Página de resultados do painel (a primeira é 1).
 *
 * @param total        total de itens depois dos filtros
 * @param totalPaginas zero quando não há itens
 */
public record Pagina<T>(List<T> itens, int pagina, int tamanho, long total, int totalPaginas) {

    public static final int TAMANHO_PADRAO = 50;
    public static final int TAMANHO_MAXIMO = 200;

    public Pagina {
        itens = List.copyOf(itens);
    }

    /** Recorta a lista já filtrada e ordenada. */
    public static <T> Pagina<T> de(List<T> todos, Integer pagina, Integer tamanho) {
        int numero = pagina == null ? 1 : pagina;
        int porPagina = tamanho == null ? TAMANHO_PADRAO : tamanho;
        if (numero < 1) {
            throw new RequisicaoInvalidaException("A página começa em 1.");
        }
        if (porPagina < 1 || porPagina > TAMANHO_MAXIMO) {
            throw new RequisicaoInvalidaException("O tamanho da página vai de 1 a " + TAMANHO_MAXIMO + ".");
        }
        int totalPaginas = (int) Math.ceil(todos.size() / (double) porPagina);
        int inicio = Math.min((numero - 1) * porPagina, todos.size());
        int fim = Math.min(inicio + porPagina, todos.size());
        return new Pagina<>(todos.subList(inicio, fim), numero, porPagina, todos.size(), totalPaginas);
    }

    public <R> Pagina<R> mapear(Function<T, R> conversao) {
        return new Pagina<>(itens.stream().map(conversao).toList(), pagina, tamanho, total, totalPaginas);
    }
}
