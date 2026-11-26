package br.com.rotasegura.shared.integration;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.absent;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.get;
import static com.github.tomakehurst.wiremock.client.WireMock.getRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.okJson;
import static com.github.tomakehurst.wiremock.client.WireMock.serverError;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static com.github.tomakehurst.wiremock.core.WireMockConfiguration.wireMockConfig;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.rotasegura.BancoDeTeste;
import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.alunos.integration.AlunosClient;
import br.com.rotasegura.dispositivos.integration.DispositivosClient;
import br.com.rotasegura.presenca.integration.PresencaClient;
import br.com.rotasegura.responsaveis.integration.ResponsaveisClient;
import br.com.rotasegura.shared.erro.ApiExternaIndisponivelException;
import br.com.rotasegura.shared.erro.RecursoNaoEncontradoException;
import br.com.rotasegura.veiculos.integration.VeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculosClient;
import com.github.tomakehurst.wiremock.junit5.WireMockExtension;
import com.github.tomakehurst.wiremock.stubbing.Scenario;
import io.github.resilience4j.circuitbreaker.CallNotPermittedException;
import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Clientes da API externa contra um servidor falso (WireMock). Todos os dados são fictícios. */
@SpringBootTest(properties = {
        "rota-segura.api-externa.read-timeout=300ms",
        "rota-segura.api-externa.max-paginas=5",
        "resilience4j.retry.configs.default.wait-duration=10ms"
})
@Import(BancoDeTeste.class)
class IntegracaoApiExternaTest {

    @RegisterExtension
    static final WireMockExtension API = WireMockExtension.newInstance()
            .options(wireMockConfig().dynamicPort())
            .build();

    @DynamicPropertySource
    static void propriedades(DynamicPropertyRegistry registry) {
        registry.add("rota-segura.api-externa.base-url", API::baseUrl);
    }

    @Autowired
    VeiculosClient veiculos;
    @Autowired
    DispositivosClient dispositivos;
    @Autowired
    AlunosClient alunos;
    @Autowired
    ResponsaveisClient responsaveis;
    @Autowired
    PresencaClient presenca;
    @Autowired
    ChamadaResiliente chamada;
    @Autowired
    CircuitBreakerRegistry circuitBreakers;

    @BeforeEach
    void limpar() {
        chamada.limparTudo();
        circuitBreakers.getAllCircuitBreakers().forEach(CircuitBreaker::reset);
    }

    @Test
    void percorreTodasAsPaginasEUsaCacheNaSegundaChamada() {
        stubPaginaVeiculos(1, "\"1\"", 3, "AAA0A01", "AAA0A02");
        stubPaginaVeiculos(2, "\"2\"", 3, "AAA0A03", "AAA0A04"); // current_page como texto, como a API real faz
        stubPaginaVeiculos(3, "3", 3, "AAA0A05", "AAA0A06");

        ResultadoCache<ColecaoPaginada<VeiculoDto>> resultado = veiculos.listarTodos();

        assertThat(resultado.desatualizado()).isFalse();
        assertThat(resultado.valor().truncada()).isFalse();
        assertThat(resultado.valor().paginasLidas()).isEqualTo(3);
        assertThat(resultado.valor().itens()).extracting(VeiculoDto::placa)
                .containsExactly("AAA0A01", "AAA0A02", "AAA0A03", "AAA0A04", "AAA0A05", "AAA0A06");
        assertThat(resultado.valor().itens().get(0).identificadorRastreador()).isEqualTo("RASTREADOR-FICTICIO");

        veiculos.listarTodos();
        API.verify(3, getRequestedFor(urlPathEqualTo("/api/veiculos")));
        API.verify(getRequestedFor(urlPathEqualTo("/api/veiculos"))
                .withQueryParam("page", equalTo("2"))
                .withHeader("Authorization", absent()));
    }

    @Test
    void paraNoLimiteDePaginasEMarcaComoTruncada() {
        API.stubFor(get(urlPathEqualTo("/api/dispositivos_faciais")).willReturn(okJson("""
                {"data":[{"id":"1","descricao":"LEITOR FICTICIO","veiculo_id":"","mac":"00:00:00:00:00:01",
                  "veiculo_prefixo":"","veiculo_identificador_rastreador":"","tipo_de_uso_dispositivo_id":"2",
                  "tipo_de_uso_dispositivo_descricao":"ESCOLAR","escola_latitude":"-10.5","escola_longitude":"-50.25",
                  "escola_id":"1"}],
                 "meta":{"total":10,"per_page":1,"current_page":1,"last_page":10}}""")));

        var resultado = dispositivos.listarTodos().valor();

        assertThat(resultado.truncada()).isTrue();
        assertThat(resultado.paginasLidas()).isEqualTo(5);
        assertThat(resultado.itens()).hasSize(5);
        assertThat(resultado.itens().get(0).veiculoId()).isEmpty();
        assertThat(resultado.itens().get(0).tipoDeUsoDispositivoDescricao()).isEqualTo("ESCOLAR");
    }

    @Test
    void repeteAChamadaQuandoAApiDevolve500() {
        API.stubFor(get(urlPathEqualTo("/api/veiculos")).inScenario("instavel")
                .whenScenarioStateIs(Scenario.STARTED)
                .willReturn(serverError())
                .willSetStateTo("recuperada"));
        API.stubFor(get(urlPathEqualTo("/api/veiculos")).inScenario("instavel")
                .whenScenarioStateIs("recuperada")
                .willReturn(okJson(paginaVeiculos("1", 1, "AAA0A01"))));

        var resultado = veiculos.listarPagina(1);

        assertThat(resultado.desatualizado()).isFalse();
        assertThat(resultado.valor().data()).hasSize(1);
        API.verify(2, getRequestedFor(urlPathEqualTo("/api/veiculos")));
    }

    @Test
    void erro500PersistenteSemCacheViraIndisponivelAposTresTentativas() {
        API.stubFor(get(urlPathEqualTo("/api/alunos")).willReturn(serverError()));

        assertThatThrownBy(() -> alunos.listarPagina(1))
                .isInstanceOf(ApiExternaIndisponivelException.class)
                .hasMessageContaining("alunos");

        API.verify(3, getRequestedFor(urlPathEqualTo("/api/alunos")));
    }

    @Test
    void timeoutEhRepetidoEViraIndisponivel() {
        API.stubFor(get(urlPathEqualTo("/api/responsaveis"))
                .willReturn(okJson("{\"data\":[],\"meta\":{}}").withFixedDelay(1500)));

        assertThatThrownBy(() -> responsaveis.listarPagina(1))
                .isInstanceOf(ApiExternaIndisponivelException.class);

        API.verify(3, getRequestedFor(urlPathEqualTo("/api/responsaveis")));
    }

    @Test
    void comFalhaDevolveUltimoValorMarcadoComoDesatualizado() {
        API.stubFor(get(urlPathEqualTo("/api/responsaveis")).willReturn(okJson("""
                {"data":[{"id":"7","nome":"Responsavel Ficticio","criado_em":"2026-01-01 08:00:00","excluido_em":"",
                  "chatwoot_contact_id":"","chatwoot_conversation_id":""}],
                 "meta":{"total":1,"per_page":100,"current_page":1,"last_page":1}}""")));
        var primeiro = responsaveis.listarPagina(1);
        assertThat(primeiro.desatualizado()).isFalse();

        chamada.invalidarRecentes(); // simula o vencimento do TTL
        API.resetAll();
        API.stubFor(get(urlPathEqualTo("/api/responsaveis")).willReturn(serverError()));

        var segundo = responsaveis.listarPagina(1);

        assertThat(segundo.desatualizado()).isTrue();
        assertThat(segundo.obtidoEm()).isEqualTo(primeiro.obtidoEm());
        assertThat(segundo.valor().data().get(0).id()).isEqualTo("7");
    }

    @Test
    void circuitoAbreDepoisDeFalhasSeguidasEParaDeChamarAApi() {
        API.stubFor(get(urlPathEqualTo("/api/presenca_escolar")).willReturn(serverError()));

        for (int i = 0; i < 5; i++) {
            assertThatThrownBy(() -> presenca.listarPagina(1))
                    .isInstanceOf(ApiExternaIndisponivelException.class);
        }
        API.verify(15, getRequestedFor(urlPathEqualTo("/api/presenca_escolar")));
        assertThat(circuitBreakers.circuitBreaker("presenca").getState()).isEqualTo(CircuitBreaker.State.OPEN);

        assertThatThrownBy(() -> presenca.listarPagina(1))
                .isInstanceOf(ApiExternaIndisponivelException.class)
                .hasCauseInstanceOf(CallNotPermittedException.class);
        API.verify(15, getRequestedFor(urlPathEqualTo("/api/presenca_escolar")));

        // O circuito é por recurso: veículos continua funcionando.
        API.stubFor(get(urlPathEqualTo("/api/veiculos")).willReturn(okJson(paginaVeiculos("1", 1, "AAA0A01"))));
        assertThat(veiculos.listarPagina(1).valor().data()).hasSize(1);
    }

    @Test
    void buscaPorIdLeMatriculasEInexistenteViraNaoEncontrado() {
        API.stubFor(get(urlPathEqualTo("/api/alunos/42")).willReturn(okJson("""
                {"id":"42","nome":"Aluno Ficticio","":"","cpf":"000.000.000-00","data_nascimento":"2015-03-10",
                 "endereco_informado_id":"","tipo_status_id":"1","imagem":"","registrado_dispositivo":"1",
                 "matriculas":[{"escola_turma_descricao_turma":"5 ANO A","escola_turma_ano_letivo":"2026",
                   "escola_turma_escola_nome":"Escola Ficticia","escola_turma_turno_descricao":"MANHA",
                   "escola_turma_turma_descricao":"5 ANO","escola_turma_id":"9",
                   "escola_turma_situacao_turma_descricao":"ATIVA"}]}""")));
        API.stubFor(get(urlPathEqualTo("/api/alunos/99")).willReturn(aResponse().withStatus(404)));

        AlunoDto aluno = alunos.buscarPorId(42).valor();

        assertThat(aluno.id()).isEqualTo("42");
        assertThat(aluno.matriculas()).hasSize(1);
        assertThat(aluno.matriculas().get(0).escolaTurmaId()).isEqualTo("9");
        assertThat(aluno.matriculas().get(0).escolaTurmaAnoLetivo()).isEqualTo("2026");

        assertThatThrownBy(() -> alunos.buscarPorId(99))
                .isInstanceOf(RecursoNaoEncontradoException.class);
        // 404 não é falha da API: não repete nem conta para o circuito.
        API.verify(1, getRequestedFor(urlPathEqualTo("/api/alunos/99")));
    }

    @Test
    void dadosDoVeiculoLeSoALocalizacaoEAceitaErroDoRastreador() {
        // Formato conferido na API real (só nomes de campos); valores fictícios.
        API.stubFor(get(urlPathEqualTo("/api/veiculos/7/dados")).willReturn(okJson("""
                {"veiculo":{"id":7,"placa":"AAA0A07"},
                 "kpi":{"alunosABordo":1,"capacidadeMaxima":40,"percentualOcupacao":2.5},
                 "localizacao":{"id":1,"attributes":{"distance":0.0,"totalDistance":10.0,"motion":true},
                   "deviceId":3,"protocol":"ficticio","serverTime":"2026-03-10T10:59:58.000+00:00",
                   "deviceTime":"2026-03-10T10:59:57.000+00:00","fixTime":"2026-03-10T10:59:57.000+00:00",
                   "valid":true,"latitude":-10.01,"longitude":-50.0,"altitude":0.0,"speed":12.5,"course":90.0,
                   "address":null,"accuracy":0.0,"network":null,"geofenceIds":null},
                 "alunos_na_rota":{"alunoId":42,"nome":"Aluno Ficticio","turma":"1A","horarioEmbarque":"07:00",
                   "pontoEmbarque":"Ponto Ficticio"},
                 "eventos":[],"ultimo_motorista":null}""")));
        API.stubFor(get(urlPathEqualTo("/api/veiculos/8/dados")).willReturn(okJson("""
                {"veiculo":{"id":8},"localizacao":{"msg":"erro fictício do rastreador","error":true}}""")));

        var dados = veiculos.dados(7);
        assertThat(dados.localizacao().latitude()).isEqualTo(-10.01);
        assertThat(dados.localizacao().speed()).isEqualTo(12.5);
        assertThat(dados.localizacao().fixTime()).isEqualTo("2026-03-10T10:59:57.000+00:00");
        assertThat(dados.localizacao().attributes().motion()).isTrue();
        assertThat(dados.toString()).as("nome do aluno nem é desserializado").doesNotContain("Ficticio");
        assertThat(dados.capacidadeInformada()).as("veiculo.capacidade ausente: usa kpi.capacidadeMaxima")
                .isEqualTo(40);

        var comErro = veiculos.dados(8);
        assertThat(comErro.localizacao().latitude()).isNull();
        assertThat(comErro.localizacao().fixTime()).isNull();
        assertThat(comErro.capacidadeInformada()).as("sem capacidade na API: zerada").isZero();
    }

    private static void stubPaginaVeiculos(int pagina, String currentPageJson, int ultima, String... placas) {
        API.stubFor(get(urlPathEqualTo("/api/veiculos"))
                .withQueryParam("page", equalTo(String.valueOf(pagina)))
                .willReturn(okJson(paginaVeiculos(currentPageJson, ultima, placas))));
    }

    private static String paginaVeiculos(String currentPageJson, int ultima, String... placas) {
        StringBuilder itens = new StringBuilder();
        for (int i = 0; i < placas.length; i++) {
            if (i > 0) {
                itens.append(',');
            }
            itens.append("""
                    {"id":"%d","placa":"%s","marca":"MARCA","modelo":"MODELO",
                     "identificador_rastreador":"RASTREADOR-FICTICIO","imagem":"","cor":"AMARELO","prefixo":"%d"}"""
                    .formatted(i + 1, placas[i], i + 10));
        }
        return """
                {"data":[%s],"meta":{"total":6,"per_page":2,"current_page":%s,"last_page":%d}}"""
                .formatted(itens, currentPageJson, ultima);
    }
}
