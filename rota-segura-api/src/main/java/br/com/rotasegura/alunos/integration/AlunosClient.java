package br.com.rotasegura.alunos.integration;

import br.com.rotasegura.shared.integration.ClienteApiExterna;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.PaginaApi;
import br.com.rotasegura.shared.integration.Recurso;
import br.com.rotasegura.shared.integration.ResultadoCache;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;

/**
 * Alunos na API externa (somente GET).
 * {@code kpi/{id}} não tem resposta documentada no contrato e fica de fora
 * até o formato ser confirmado; {@code sincronizar} é acionado sem ler o corpo.
 */
@Component
public class AlunosClient {

    static final String CAMINHO = "/api/alunos";
    private static final ParameterizedTypeReference<PaginaApi<AlunoDto>> PAGINA =
            new ParameterizedTypeReference<>() {
            };

    private final ClienteApiExterna api;

    public AlunosClient(ClienteApiExterna api) {
        this.api = api;
    }

    public ResultadoCache<PaginaApi<AlunoDto>> listarPagina(int pagina) {
        return api.pagina(Recurso.ALUNOS, CAMINHO, pagina, PAGINA);
    }

    public ResultadoCache<ColecaoPaginada<AlunoDto>> listarTodos() {
        return api.todas(Recurso.ALUNOS, CAMINHO, PAGINA);
    }

    public ResultadoCache<AlunoDto> buscarPorId(long id) {
        return api.porId(Recurso.ALUNOS, CAMINHO, id, AlunoDto.class);
    }

    /**
     * Pede à API externa que sincronize os alunos ({@code GET /api/alunos/sincronizar}).
     * O corpo da resposta não é lido; o cache de alunos é descartado em seguida.
     *
     * @return status HTTP da API externa
     */
    public int sincronizar() {
        return api.acionar(Recurso.ALUNOS, CAMINHO + "/sincronizar");
    }
}
