package br.com.rotasegura.veiculos.integration;

import br.com.rotasegura.shared.integration.ClienteApiExterna;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.PaginaApi;
import br.com.rotasegura.shared.integration.Recurso;
import br.com.rotasegura.shared.integration.ResultadoCache;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;

/** Veículos na API externa (somente GET). */
@Component
public class VeiculosClient {

    static final String CAMINHO = "/api/veiculos";
    private static final ParameterizedTypeReference<PaginaApi<VeiculoDto>> PAGINA =
            new ParameterizedTypeReference<>() {
            };

    private final ClienteApiExterna api;

    public VeiculosClient(ClienteApiExterna api) {
        this.api = api;
    }

    public ResultadoCache<PaginaApi<VeiculoDto>> listarPagina(int pagina) {
        return api.pagina(Recurso.VEICULOS, CAMINHO, pagina, PAGINA);
    }

    public ResultadoCache<ColecaoPaginada<VeiculoDto>> listarTodos() {
        return api.todas(Recurso.VEICULOS, CAMINHO, PAGINA);
    }
}
