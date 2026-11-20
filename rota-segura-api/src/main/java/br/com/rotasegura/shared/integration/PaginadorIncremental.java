package br.com.rotasegura.shared.integration;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.function.IntFunction;

/**
 * Percorre um recurso paginado que só cresce no fim (registros novos entram na última página), lendo de novo
 * apenas o que pode ter mudado.
 *
 * <p>Por que: a presença tem dezenas de páginas e cresce o ano inteiro; ler tudo a cada 30 s leva dezenas de
 * segundos e pesa na API externa. Conferido na API real: as leituras vêm em ordem crescente de id e as novas
 * aparecem no fim.
 *
 * <p>Regras:
 * <ul>
 *   <li>Página cheia que não é a última fica "fechada" e não é lida de novo.</li>
 *   <li>Cada rodada relê a primeira página ainda aberta e segue até {@code last_page}.</li>
 *   <li>Se o total informado pela API não bate com o que foi montado, ou se a página seguinte às fechadas
 *       sumiu (registro apagado ou inserido no meio), a leitura recomeça do zero na hora.</li>
 *   <li>De tempos em tempos ({@code revalidacaoCompleta}) relê tudo, para pegar registros corrigidos em páginas
 *       antigas.</li>
 * </ul>
 * Thread-safe: uma rodada por vez.
 */
public final class PaginadorIncremental<T> {

    private final Duration revalidacaoCompleta;
    private final List<List<T>> fechadas = new ArrayList<>();
    private Instant ultimaLeituraCompleta;

    public PaginadorIncremental(Duration revalidacaoCompleta) {
        this.revalidacaoCompleta = revalidacaoCompleta;
    }

    /**
     * @param buscarPagina função que busca uma página (a primeira é 1)
     * @param maxPaginas   limite de páginas lidas numa rodada; se atingido, o resultado vem truncado e a próxima
     *                     rodada continua de onde parou
     * @param agora        hora atual (para a revalidação completa)
     */
    public synchronized ColecaoPaginada<T> atualizar(IntFunction<PaginaApi<T>> buscarPagina, int maxPaginas,
                                                     Instant agora) {
        if (maxPaginas < 1) {
            throw new IllegalArgumentException("maxPaginas deve ser >= 1");
        }
        if (ultimaLeituraCompleta == null || !agora.isBefore(ultimaLeituraCompleta.plus(revalidacaoCompleta))) {
            recomecar(agora);
        }
        boolean incremental = !fechadas.isEmpty();
        Rodada<T> rodada = ler(buscarPagina, maxPaginas);
        if (incremental && !rodada.confere()) {
            // Algo mudou no meio das páginas já guardadas: relê tudo agora.
            recomecar(agora);
            rodada = ler(buscarPagina, maxPaginas);
        }
        return rodada.resultado();
    }

    /** Páginas guardadas como fechadas (para teste e métrica). */
    public synchronized int paginasFechadas() {
        return fechadas.size();
    }

    private void recomecar(Instant agora) {
        fechadas.clear();
        ultimaLeituraCompleta = agora;
    }

    private Rodada<T> ler(IntFunction<PaginaApi<T>> buscarPagina, int maxPaginas) {
        List<List<T>> abertas = new ArrayList<>();
        int pagina = fechadas.size() + 1;
        int lidas = 0;
        Meta meta = null;
        boolean truncada = false;
        boolean sumiu = false;
        while (true) {
            PaginaApi<T> resposta = buscarPagina.apply(pagina);
            lidas++;
            if (resposta == null || resposta.data().isEmpty()) {
                // Logo depois das páginas fechadas sempre há ao menos a página atual: vazia indica apagamento.
                sumiu = abertas.isEmpty() && !fechadas.isEmpty();
                break;
            }
            meta = resposta.meta();
            abertas.add(resposta.data());
            if (ultimaPagina(meta, pagina)) {
                break;
            }
            if (lidas >= maxPaginas) {
                truncada = true;
                break;
            }
            pagina++;
        }
        List<T> itens = new ArrayList<>();
        fechadas.forEach(itens::addAll);
        abertas.forEach(itens::addAll);
        boolean totalConfere = truncada || meta == null || meta.total() == null || meta.total() == itens.size();
        if (!sumiu && totalConfere) {
            // Fecha as páginas cheias; a última lida fica aberta porque ainda pode crescer.
            int porPagina = meta != null && meta.perPage() != null ? meta.perPage() : -1;
            while (abertas.size() > 1 && porPagina > 0 && abertas.getFirst().size() == porPagina) {
                fechadas.add(List.copyOf(abertas.removeFirst()));
            }
        }
        return new Rodada<>(new ColecaoPaginada<>(itens, lidas, truncada), !sumiu && totalConfere);
    }

    private static boolean ultimaPagina(Meta meta, int paginaAtual) {
        // Sem meta confiável não dá para saber se há mais páginas: para aqui em vez de adivinhar.
        return meta == null || meta.lastPage() == null || paginaAtual >= meta.lastPage();
    }

    private record Rodada<E>(ColecaoPaginada<E> resultado, boolean confere) {
    }
}
