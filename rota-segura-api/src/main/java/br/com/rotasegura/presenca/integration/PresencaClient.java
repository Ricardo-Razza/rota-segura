package br.com.rotasegura.presenca.integration;

import br.com.rotasegura.shared.integration.ClienteApiExterna;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.PaginaApi;
import br.com.rotasegura.shared.integration.Recurso;
import br.com.rotasegura.shared.integration.ResultadoCache;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;

/**
 * Leituras de presença na API externa (somente GET).
 * As rotas {@code dados}, {@code kpis} e {@code obter-notificacoes} não têm resposta documentada
 * no contrato e ficam de fora até o formato ser confirmado.
 */
@Component
public class PresencaClient {

    static final String CAMINHO = "/api/presenca_escolar";
    private static final ParameterizedTypeReference<PaginaApi<PresencaDto>> PAGINA =
            new ParameterizedTypeReference<>() {
            };

    private final ClienteApiExterna api;

    public PresencaClient(ClienteApiExterna api) {
        this.api = api;
    }

    public ResultadoCache<PaginaApi<PresencaDto>> listarPagina(int pagina) {
        return api.pagina(Recurso.PRESENCA, CAMINHO, pagina, PAGINA);
    }

    public ResultadoCache<ColecaoPaginada<PresencaDto>> listarTodas() {
        return api.todas(Recurso.PRESENCA, CAMINHO, PAGINA);
    }

    public ResultadoCache<PresencaDto> buscarPorId(long id) {
        return api.porId(Recurso.PRESENCA, CAMINHO, id, PresencaDto.class);
    }
}
