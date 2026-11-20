package br.com.rotasegura.shared.integration;

import br.com.rotasegura.shared.erro.RecursoNaoEncontradoException;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;

/**
 * Base dos clientes da API externa: lista paginada, coleção completa e busca por id.
 * Só usa {@code RestClient.get()}.
 */
@Component
public class ClienteApiExterna {

    private final RestClient restClient;
    private final ChamadaResiliente chamada;
    private final ApiExternaProperties props;
    private final Clock clock;
    private final Map<String, PaginadorIncremental<?>> incrementais = new ConcurrentHashMap<>();

    public ClienteApiExterna(RestClient apiExternaRestClient, ChamadaResiliente chamada, ApiExternaProperties props,
                             Clock clock) {
        this.restClient = apiExternaRestClient;
        this.chamada = chamada;
        this.props = props;
        this.clock = clock;
    }

    /** Uma página do recurso (a primeira é 1). */
    public <T> ResultadoCache<PaginaApi<T>> pagina(Recurso recurso, String caminho, int pagina,
                                                   ParameterizedTypeReference<PaginaApi<T>> tipo) {
        return chamada.comCache(recurso, caminho + "?pagina=" + pagina,
                () -> chamada.protegida(recurso, () -> getPagina(caminho, pagina, tipo)));
    }

    /** Todas as páginas do recurso, até o limite configurado. */
    public <T> ResultadoCache<ColecaoPaginada<T>> todas(Recurso recurso, String caminho,
                                                        ParameterizedTypeReference<PaginaApi<T>> tipo) {
        return chamada.comCache(recurso, caminho + "#todas",
                () -> PaginadorApi.buscarTodas(
                        pagina -> chamada.protegida(recurso, () -> getPagina(caminho, pagina, tipo)),
                        props.maxPaginas()));
    }

    /**
     * Todas as páginas de um recurso que só cresce no fim (ex.: presença), relendo só as páginas que podem ter
     * mudado. Mesmo cache e proteção de {@link #todas}; ver {@link PaginadorIncremental}.
     */
    @SuppressWarnings("unchecked")
    public <T> ResultadoCache<ColecaoPaginada<T>> todasIncremental(Recurso recurso, String caminho,
                                                                   ParameterizedTypeReference<PaginaApi<T>> tipo) {
        PaginadorIncremental<T> paginador = (PaginadorIncremental<T>) incrementais.computeIfAbsent(caminho,
                c -> new PaginadorIncremental<T>(props.revalidacaoCompleta()));
        return chamada.comCache(recurso, caminho + "#todas",
                () -> paginador.atualizar(
                        pagina -> chamada.protegida(recurso, () -> getPagina(caminho, pagina, tipo)),
                        props.maxPaginas(), clock.instant()));
    }

    /** Um registro pelo id. */
    public <T> ResultadoCache<T> porId(Recurso recurso, String caminho, long id, Class<T> tipo) {
        return chamada.comCache(recurso, caminho + "/" + id, () -> chamada.protegida(recurso, () -> {
            try {
                T corpo = restClient.get().uri(caminho + "/{id}", id).retrieve().body(tipo);
                if (corpo == null) {
                    throw new RecursoNaoEncontradoException(recurso.nome(), id);
                }
                return corpo;
            } catch (HttpClientErrorException.NotFound e) {
                throw new RecursoNaoEncontradoException(recurso.nome(), id);
            }
        }));
    }

    /**
     * Sub-rota de um registro ({@code caminho/{id}/sufixo}), sem cache: para quem consulta em ciclo curto
     * e guarda o próprio estado (ex.: rastreamento a cada 5 s). Tem retry e circuit breaker do recurso.
     *
     * @return o corpo, ou {@code null} se a API devolver corpo vazio
     */
    public <T> T subrota(Recurso recurso, String caminho, long id, String sufixo, Class<T> tipo) {
        return chamada.protegida(recurso, () -> {
            try {
                return restClient.get().uri(caminho + "/{id}" + sufixo, id).retrieve().body(tipo);
            } catch (HttpClientErrorException.NotFound e) {
                throw new RecursoNaoEncontradoException(recurso.nome(), id);
            }
        });
    }

    /**
     * Aciona uma rota GET de operação (ex.: {@code /api/alunos/sincronizar}), sem cache e descartando o corpo:
     * a resposta não tem formato documentado e pode conter dado pessoal.
     *
     * @return o status HTTP devolvido
     */
    public int acionar(Recurso recurso, String caminho) {
        int status = chamada.protegida(recurso,
                () -> restClient.get().uri(caminho).retrieve().toBodilessEntity().getStatusCode().value());
        chamada.invalidarRecentes(recurso);
        return status;
    }

    private <T> PaginaApi<T> getPagina(String caminho, int pagina, ParameterizedTypeReference<PaginaApi<T>> tipo) {
        return restClient.get()
                .uri(uri -> uri.path(caminho).queryParam(props.parametroPagina(), pagina).build())
                .retrieve()
                .body(tipo);
    }
}
