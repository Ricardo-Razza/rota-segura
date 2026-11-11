package br.com.rotasegura.responsaveis.integration;

import br.com.rotasegura.shared.integration.ClienteApiExterna;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.PaginaApi;
import br.com.rotasegura.shared.integration.Recurso;
import br.com.rotasegura.shared.integration.ResultadoCache;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;

/** Responsáveis na API externa (somente GET). */
@Component
public class ResponsaveisClient {

    static final String CAMINHO = "/api/responsaveis";
    private static final ParameterizedTypeReference<PaginaApi<ResponsavelDto>> PAGINA =
            new ParameterizedTypeReference<>() {
            };

    private final ClienteApiExterna api;

    public ResponsaveisClient(ClienteApiExterna api) {
        this.api = api;
    }

    public ResultadoCache<PaginaApi<ResponsavelDto>> listarPagina(int pagina) {
        return api.pagina(Recurso.RESPONSAVEIS, CAMINHO, pagina, PAGINA);
    }

    public ResultadoCache<ColecaoPaginada<ResponsavelDto>> listarTodos() {
        return api.todas(Recurso.RESPONSAVEIS, CAMINHO, PAGINA);
    }

    public ResultadoCache<ResponsavelDto> buscarPorId(long id) {
        return api.porId(Recurso.RESPONSAVEIS, CAMINHO, id, ResponsavelDto.class);
    }
}
