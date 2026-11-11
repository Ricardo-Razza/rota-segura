package br.com.rotasegura.dispositivos.integration;

import br.com.rotasegura.shared.integration.ClienteApiExterna;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.PaginaApi;
import br.com.rotasegura.shared.integration.Recurso;
import br.com.rotasegura.shared.integration.ResultadoCache;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;

/** Leitores faciais na API externa (somente GET). */
@Component
public class DispositivosClient {

    static final String CAMINHO = "/api/dispositivos_faciais";
    private static final ParameterizedTypeReference<PaginaApi<DispositivoFacialDto>> PAGINA =
            new ParameterizedTypeReference<>() {
            };

    private final ClienteApiExterna api;

    public DispositivosClient(ClienteApiExterna api) {
        this.api = api;
    }

    public ResultadoCache<PaginaApi<DispositivoFacialDto>> listarPagina(int pagina) {
        return api.pagina(Recurso.DISPOSITIVOS, CAMINHO, pagina, PAGINA);
    }

    public ResultadoCache<ColecaoPaginada<DispositivoFacialDto>> listarTodos() {
        return api.todas(Recurso.DISPOSITIVOS, CAMINHO, PAGINA);
    }

    public ResultadoCache<DispositivoFacialDto> buscarPorId(long id) {
        return api.porId(Recurso.DISPOSITIVOS, CAMINHO, id, DispositivoFacialDto.class);
    }
}
