package br.com.rotasegura.shared.integration;

import br.com.rotasegura.shared.erro.RecursoNaoEncontradoException;
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

    public ClienteApiExterna(RestClient apiExternaRestClient, ChamadaResiliente chamada, ApiExternaProperties props) {
        this.restClient = apiExternaRestClient;
        this.chamada = chamada;
        this.props = props;
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

    private <T> PaginaApi<T> getPagina(String caminho, int pagina, ParameterizedTypeReference<PaginaApi<T>> tipo) {
        return restClient.get()
                .uri(uri -> uri.path(caminho).queryParam(props.parametroPagina(), pagina).build())
                .retrieve()
                .body(tipo);
    }
}
