package br.com.rotasegura;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rotasegura.alertas.application.CicloDeOperacao;
import br.com.rotasegura.alertas.domain.Alerta;
import br.com.rotasegura.alertas.domain.AlertaRepository;
import br.com.rotasegura.alertas.domain.TipoAlerta;
import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.alunos.integration.AlunosClient;
import br.com.rotasegura.alunos.integration.MatriculaDto;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.dispositivos.integration.DispositivosClient;
import br.com.rotasegura.jornada.domain.Severidade;
import br.com.rotasegura.presenca.integration.PresencaClient;
import br.com.rotasegura.presenca.integration.PresencaDto;
import br.com.rotasegura.responsaveis.integration.ResponsaveisClient;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.ResultadoCache;
import br.com.rotasegura.veiculos.application.RastreamentoService;
import br.com.rotasegura.veiculos.integration.DadosVeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculosClient;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Operação (Fases 2.2b e 3.1) com relógio fixo: terça, 10/03/2026, 08:00 em Brasília (dentro da rota).
 * Cenário fictício: veículo 7 (capacidade 1, em veiculo.capacidade) leva à escola 50; veículo 8 (capacidade 10,
 * só em kpi.capacidadeMaxima) à escola 60. A capacidade vem de /dados, como na API real.
 */
@SpringBootTest(properties = {
        "rota-segura.dashboard.etapas.INFANTIL[0]=Pré II",
        "rota-segura.dashboard.etapas.FUNDAMENTAL[0]=1º ano"})
@AutoConfigureMockMvc
@Import(BancoDeTeste.class)
class OperacaoEndpointsTest {

    private static final String DIA = "2026-03-10";
    private static final Instant AGORA = Instant.parse(DIA + "T11:00:00Z");

    @Autowired
    MockMvc mvc;
    @Autowired
    CicloDeOperacao ciclo;
    @Autowired
    AlertaRepository alertas;
    @Autowired
    RastreamentoService rastreamento;
    @Autowired
    io.micrometer.core.instrument.MeterRegistry registro;

    @MockitoSpyBean
    Clock relogio;
    @MockitoBean
    AlunosClient alunos;
    @MockitoBean
    DispositivosClient dispositivos;
    @MockitoBean
    PresencaClient presencas;
    @MockitoBean
    VeiculosClient veiculos;
    @MockitoBean
    ResponsaveisClient responsaveis;

    @BeforeEach
    void cenario() {
        alertas.deleteAll();
        rastreamento.reiniciar();
        doReturn(AGORA).when(relogio).instant();
        doReturn(AGORA.toEpochMilli()).when(relogio).millis();
        doReturn(ZoneOffset.UTC).when(relogio).getZone();

        when(veiculos.listarTodos()).thenReturn(atual(List.of(
                new VeiculoDto("7", "AAA0A07", "Marca", "Modelo", "R-7", null, "Branco", "P-07"),
                new VeiculoDto("8", "BBB0B08", "Marca", "Modelo", "R-8", null, "Branco", "P-08"))));
        when(dispositivos.listarTodos()).thenReturn(atual(List.of(
                leitor("11", "1", "7", "50"), leitor("21", "2", null, "50"),
                leitor("12", "1", "8", "60"), leitor("22", "2", null, "60"),
                leitor("31", "9", null, "50"))));
        when(alunos.listarTodos()).thenReturn(atual(List.of(
                aluno("101", "Pré II"), aluno("102", "1º ano"), aluno("103", "1º ano"))));
        when(presencas.listarTodas()).thenReturn(atual(List.of(
                presenca("1", "101", DIA + " 07:00:00", "11"),
                presenca("2", "101", DIA + " 07:25:00", "21"),
                presenca("3", "103", DIA + " 07:02:00", "11"),
                presenca("4", "103", DIA + " 07:30:00", "21"),
                presenca("5", "102", DIA + " 07:05:00", "12"))));
        // Capacidade lida de /dados junto com o GPS (sem posição aqui: rastreador sem localização válida).
        when(veiculos.dados(7)).thenReturn(new DadosVeiculoDto(null, new DadosVeiculoDto.CadastroDto("1"), null));
        when(veiculos.dados(8)).thenReturn(new DadosVeiculoDto(null, new DadosVeiculoDto.CadastroDto(null),
                new DadosVeiculoDto.KpiDto("10")));
        rastreamento.atualizar();
    }

    @Test
    void statusDosVeiculosUsaAMesmaRegraDeLotacaoEEscopo() throws Exception {
        mvc.perform(get("/api/v1/veiculos/status").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.veiculos[0].placa").value("AAA0A07"))
                .andExpect(jsonPath("$.veiculos[0].embarcados").value(2))
                .andExpect(jsonPath("$.veiculos[0].capacidade").value(1))
                .andExpect(jsonPath("$.veiculos[1].capacidade").value(10))
                .andExpect(jsonPath("$.veiculos[0].ocupacao").value(200.0))
                .andExpect(jsonPath("$.veiculos[0].faixaOcupacao").value("CRITICO"))
                .andExpect(jsonPath("$.veiculos[0].estado").value("CONCLUIDO"))
                // 102 embarcou às 07:05 e não chegou: às 08:00 já passou da janela (40 min). Vira alerta
                // crítico, mas não deixa o veículo "em rota" o dia inteiro.
                .andExpect(jsonPath("$.veiculos[1].estado").value("CONCLUIDO"))
                .andExpect(jsonPath("$.veiculos[1].aBordo").value(0))
                .andExpect(jsonPath("$.veiculos[1].faixaOcupacao").value("OK"))
                .andExpect(jsonPath("$.porEstado.EM_ROTA").value(0));

        mvc.perform(get("/api/v1/veiculos/status").with(token("MONITOR", List.of(), List.of(8L))))
                .andExpect(jsonPath("$.veiculos.length()").value(1))
                .andExpect(jsonPath("$.veiculos[0].id").value(8));
        mvc.perform(get("/api/v1/veiculos/7").with(token("MONITOR", List.of(), List.of(8L))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/veiculos/8").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.embarcados[0].alunoId").value(102))
                .andExpect(jsonPath("$.embarcados[0].iniciais").value("AF"))
                .andExpect(jsonPath("$.embarcados[0].nome").doesNotExist());
    }

    @Test
    void veiculoSoFicaEmRotaComAlunoABordoDentroDaJanela() throws Exception {
        when(presencas.listarTodas()).thenReturn(atual(List.of(
                presenca("1", "101", DIA + " 07:00:00", "11"),
                presenca("2", "101", DIA + " 07:25:00", "21"),
                presenca("5", "102", DIA + " 07:45:00", "12"))));

        mvc.perform(get("/api/v1/veiculos/status").with(perfil("GESTAO")))
                .andExpect(jsonPath("$.veiculos[1].placa").value("BBB0B08"))
                .andExpect(jsonPath("$.veiculos[1].estado").value("EM_ROTA"))
                .andExpect(jsonPath("$.veiculos[1].aBordo").value(1))
                .andExpect(jsonPath("$.porEstado.EM_ROTA").value(1));
    }

    @Test
    void cercaVirtualAlertaVeiculoParadoNaEscolaComAlunoABordoERespeitaEscopo() throws Exception {
        // 102 embarcou no veículo 8 às 07:45 e não passou no leitor da escola 60 (a bordo às 08:00).
        when(presencas.listarTodas()).thenReturn(atual(List.of(
                presenca("5", "102", DIA + " 07:45:00", "12"))));

        // 07:49: GPS a ~55 m da escola (coordenada fictícia dos leitores: -10.0, -50.0).
        relogioEm("T10:49:00Z");
        when(veiculos.dados(8)).thenReturn(gps(-10.0005, DIA + "T07:48:50-03:00"));
        rastreamento.atualizar();
        // 08:00: continua dentro da cerca, posição recente.
        relogioEm("T11:00:00Z");
        when(veiculos.dados(8)).thenReturn(gps(-10.0003, DIA + "T07:59:55-03:00"));
        rastreamento.atualizar();

        ciclo.executar();
        Alerta cerca = alertas.findByChave("CERCA_VIRTUAL_SEM_DESEMBARQUE:VEICULO:8:" + DIA).orElseThrow();
        assertThat(cerca.getSeveridade()).isEqualTo(Severidade.ATENCAO);
        assertThat(cerca.getMensagem()).contains("BBB0B08").contains("escola #60").contains("07:48")
                .contains("1 aluno a bordo").doesNotContain("Fictício");

        mvc.perform(get("/api/v1/veiculos/rastreamento").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intervaloS").value(5))
                .andExpect(jsonPath("$.veiculos[0].veiculoId").value(8))
                .andExpect(jsonPath("$.veiculos[0].escolaId").value(60))
                .andExpect(jsonPath("$.veiculos[0].naCercaDaEscola").value(true))
                .andExpect(jsonPath("$.veiculos[0].atrasada").value(false))
                .andExpect(jsonPath("$.veiculos[0].rastro.length()").value(2))
                .andExpect(jsonPath("$.veiculos[0].posicao.velocidadeKmh").value(0.0));
        mvc.perform(get("/api/v1/veiculos/rastreamento").with(token("MONITOR", List.of(), List.of(7L))))
                .andExpect(jsonPath("$.veiculos.length()").value(0));
        mvc.perform(get("/api/v1/veiculos/8/rastreamento").with(token("MONITOR", List.of(), List.of(7L))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/veiculos/8/rastreamento").with(token("DIRETOR", List.of(60L), List.of())))
                .andExpect(status().isOk());
    }

    @Test
    void semCapacidadeNaApiFicaZeradaSemFaixaNemAlertaDeLotacao() throws Exception {
        rastreamento.reiniciar();
        when(veiculos.dados(7)).thenReturn(new DadosVeiculoDto(null, new DadosVeiculoDto.CadastroDto(null),
                new DadosVeiculoDto.KpiDto(null)));
        when(veiculos.dados(8)).thenReturn(null);
        rastreamento.atualizar();

        mvc.perform(get("/api/v1/veiculos/status").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.veiculos[0].embarcados").value(2))
                .andExpect(jsonPath("$.veiculos[0].capacidade").value(0))
                .andExpect(jsonPath("$.veiculos[0].ocupacao").value(0))
                .andExpect(jsonPath("$.veiculos[0].faixaOcupacao").doesNotExist())
                .andExpect(jsonPath("$.veiculos[1].capacidade").value(0));

        ciclo.executar();
        assertThat(alertas.findByChave("LOTACAO:VEICULO:7:" + DIA)).isEmpty();
    }

    @Test
    void semGpsRecenteNaoHaAlertaDeCerca() throws Exception {
        when(presencas.listarTodas()).thenReturn(atual(List.of(
                presenca("5", "102", DIA + " 07:45:00", "12"))));
        // Última posição na escola é das 07:48 e o rastreador parou de responder: não dá para afirmar nada.
        when(veiculos.dados(8)).thenReturn(gps(-10.0005, DIA + "T07:48:00-03:00"));
        rastreamento.atualizar();

        ciclo.executar();
        assertThat(alertas.findByChave("CERCA_VIRTUAL_SEM_DESEMBARQUE:VEICULO:8:" + DIA)).isEmpty();
    }

    @Test
    void metricasEHealthDaApiExternaSemDadoPessoal() throws Exception {
        ciclo.executar();
        double criados = registro.find("rota.alertas.criados").counters().stream()
                .mapToDouble(io.micrometer.core.instrument.Counter::count).sum();
        assertThat(criados).isGreaterThan(0);
        assertThat(registro.find("rota.leitores.offline").gauge()).isNotNull();

        // Público: só o status, sem detalhes.
        mvc.perform(get("/actuator/health"))
                .andExpect(jsonPath("$.status").exists())
                .andExpect(jsonPath("$.components").doesNotExist());
        // ADMIN vê o estado dos circuitos por recurso.
        mvc.perform(get("/actuator/health").with(perfil("ADMIN")))
                .andExpect(jsonPath("$.components.apiExterna.details.alunos").value("CLOSED"));
        mvc.perform(get("/actuator/metrics/rota.alertas.criados").with(perfil("GESTAO")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/actuator/metrics/rota.alertas.criados").with(perfil("ADMIN")))
                .andExpect(status().isOk());
    }

    @Test
    void cicloCriaAlertasSemDuplicarComTextoIgualAEtiqueta() throws Exception {
        CicloDeOperacao.ResultadoCiclo primeiro = ciclo.executar();
        long total = alertas.count();
        CicloDeOperacao.ResultadoCiclo segundo = ciclo.executar();

        assertThat(primeiro.alertasCriados()).isPositive();
        assertThat(segundo.alertasCriados()).as("a mesma condição não recria alerta").isZero();
        assertThat(alertas.count()).isEqualTo(total);
        assertThat(alertas.findAll()).allSatisfy(a -> assertThat(a.getOcorrencias()).isEqualTo(1));

        Alerta lotacao = alertas.findByChave("LOTACAO:VEICULO:7:" + DIA).orElseThrow();
        assertThat(lotacao.getSeveridade()).isEqualTo(Severidade.CRITICO);
        assertThat(lotacao.getEntidadeRotulo()).isEqualTo("AAA0A07");
        assertThat(lotacao.getMensagem()).contains(lotacao.getEntidadeRotulo()).contains("200%")
                .doesNotContain("teste");

        Alerta semChegada = alertas.findByChave("EMBARCOU_SEM_CHEGADA:ALUNO:102:" + DIA).orElseThrow();
        assertThat(semChegada.getSeveridade()).isEqualTo(Severidade.CRITICO);
        assertThat(semChegada.getMensagem()).contains("BBB0B08").contains("07:05").doesNotContain("Fictício");
        assertThat(alertas.findByChave("LEITOR_TIPO_DESCONHECIDO:LEITOR:31:" + DIA)).isPresent();
        assertThat(alertas.findAll()).extracting(Alerta::getTipo).doesNotContain(TipoAlerta.CHEGOU_SEM_EMBARQUE);
    }

    @Test
    void contadoresSoDeAbertosEFluxoAssumirResolver() throws Exception {
        ciclo.executar();
        long id = alertas.findByChave("LOTACAO:VEICULO:7:" + DIA).orElseThrow().getId();

        mvc.perform(get("/api/v1/alertas/resumo").with(perfil("GESTAO")))
                .andExpect(jsonPath("$.abertosPorSeveridade.CRITICO").value(2))
                .andExpect(jsonPath("$.emAnalise").value(0));

        mvc.perform(patch("/api/v1/alertas/" + id).with(perfil("GESTAO")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"EM_ANALISE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EM_ANALISE"))
                .andExpect(jsonPath("$.assumidoPor").value(1));
        mvc.perform(get("/api/v1/alertas/resumo").with(perfil("GESTAO")))
                .andExpect(jsonPath("$.abertosPorSeveridade.CRITICO").value(1))
                .andExpect(jsonPath("$.emAnalise").value(1));

        mvc.perform(patch("/api/v1/alertas/" + id).with(perfil("GESTAO")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RESOLVIDO\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(patch("/api/v1/alertas/" + id).with(perfil("GESTAO")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"RESOLVIDO\",\"comentario\":\"Aluno remanejado para o veículo 8.\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resolvidoPor").value(1));
        mvc.perform(patch("/api/v1/alertas/" + id).with(perfil("GESTAO")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"EM_ANALISE\"}"))
                .andExpect(status().isConflict());

        ciclo.executar();
        assertThat(alertas.findById(id).orElseThrow().getStatus().name()).as("não reabre").isEqualTo("RESOLVIDO");
        mvc.perform(get("/api/v1/alertas").param("status", "ABERTO").with(perfil("GESTAO")))
                .andExpect(jsonPath("$.alertas.itens[*].id", not(hasItem((int) id))));
    }

    @Test
    void alertasRespeitamOEscopo() throws Exception {
        ciclo.executar();

        mvc.perform(get("/api/v1/alertas").with(token("DIRETOR", List.of(60L), List.of())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alertas.itens[*].escolaId", not(hasItem(50))))
                .andExpect(jsonPath("$.alertas.itens[*].entidadeId", hasItem("102")));
        long id = alertas.findByChave("LOTACAO:VEICULO:7:" + DIA).orElseThrow().getId();
        mvc.perform(patch("/api/v1/alertas/" + id).with(token("DIRETOR", List.of(60L), List.of()))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"EM_ANALISE\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void dashboardCalculaCadaEtapaSeparadamente() throws Exception {
        String corpo = mvc.perform(get("/api/v1/dashboard/resumo").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpis.alunosAtivos").value(3))
                .andExpect(jsonPath("$.kpis.naEscolaAgora").value(2))
                .andExpect(jsonPath("$.kpis.veiculosEmRota").value(0))
                // Anual: só dias letivos com leitura na escola entram no denominador (aqui, só hoje).
                // Antes contava todo dia letivo desde 1º de janeiro e dava ~2%.
                .andExpect(jsonPath("$.frequenciaAnualPorEscola[0].escolaId").value(50))
                .andExpect(jsonPath("$.frequenciaAnualPorEscola[0].esperados").value(2))
                .andExpect(jsonPath("$.frequenciaAnualPorEscola[0].frequencia").value(100.0))
                .andExpect(jsonPath("$.frequenciaAnualPorEscola[1].esperados").value(0))
                .andExpect(jsonPath("$.kpis.frequenciaHoje").value(66.7))
                .andExpect(jsonPath("$.etapasConfiguradas").value(true))
                .andExpect(jsonPath("$.frequenciaPorEtapa[0].etapa").value("INFANTIL"))
                .andExpect(jsonPath("$.frequenciaPorEtapa[1].etapa").value("FUNDAMENTAL"))
                .andExpect(jsonPath("$.frequenciaHojePorEscola[0].escolaId").value(50))
                .andExpect(jsonPath("$.frequenciaHojePorEscola[0].faixa").value("OK"))
                .andExpect(jsonPath("$.frequenciaHojePorEscola[1].faixa").value("CRITICO"))
                .andExpect(jsonPath("$.matriculas.agrupamento").value("ETAPA"))
                .andReturn().getResponse().getContentAsString();

        // Infantil: 1 aluno presente em 1 de 7 dias; Fundamental: 1 de 2 alunos em 1 de 7 dias.
        assertThat(corpo).contains("\"etapa\":\"INFANTIL\",\"esperados\":7,\"presentes\":1,\"frequencia\":14.3")
                .contains("\"etapa\":\"FUNDAMENTAL\",\"esperados\":14,\"presentes\":1,\"frequencia\":7.1");
    }

    @Test
    void indicadoresSensiveisSoParaGestaoESecretaria() throws Exception {
        mvc.perform(get("/api/v1/dashboard/sensiveis").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.disponivel").value(false))
                .andExpect(jsonPath("$.minimoPorGrupo").value(5));
        mvc.perform(get("/api/v1/dashboard/sensiveis").with(perfil("SECRETARIA"))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/dashboard/sensiveis").with(perfil("ADMIN"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/dashboard/sensiveis").with(token("DIRETOR", List.of(50L), List.of())))
                .andExpect(status().isForbidden());
    }

    @Test
    void streamAbreComHeartbeat() throws Exception {
        mvc.perform(get("/api/v1/stream").with(perfil("GESTAO")).accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted())
                .andExpect(content().string(containsString("event:heartbeat")));
    }

    private static RequestPostProcessor perfil(String perfil) {
        return token(perfil, List.of(), List.of());
    }

    private static RequestPostProcessor token(String perfil, List<Long> escolas, List<Long> veiculos) {
        return jwt().jwt(j -> j.subject("1").claim("perfil", perfil).claim("escolas", escolas)
                        .claim("veiculos", veiculos))
                .authorities(new SimpleGrantedAuthority("ROLE_" + perfil));
    }

    private void relogioEm(String horaUtc) {
        Instant instante = Instant.parse(DIA + horaUtc);
        doReturn(instante).when(relogio).instant();
        doReturn(instante.toEpochMilli()).when(relogio).millis();
    }

    private static DadosVeiculoDto gps(double latitude, String fixTime) {
        return new DadosVeiculoDto(new DadosVeiculoDto.LocalizacaoDto(latitude, -50.0, 0.0, 0.0, fixTime, true,
                new DadosVeiculoDto.Atributos(false)), null, new DadosVeiculoDto.KpiDto("10"));
    }

    private static <T> ResultadoCache<ColecaoPaginada<T>> atual(List<T> itens) {
        return new ResultadoCache<>(new ColecaoPaginada<>(itens, 1, false), AGORA, false);
    }

    private static DispositivoFacialDto leitor(String id, String tipo, String veiculoId, String escolaId) {
        return new DispositivoFacialDto(id, "Leitor fictício " + id, veiculoId, "00:00:00:00:00:00", "P-" + id,
                "R-" + id, tipo, "Tipo fictício", "-10.0", "-50.0", escolaId);
    }

    private static AlunoDto aluno(String id, String anoEscolar) {
        MatriculaDto matricula = new MatriculaDto("9" + id, "Turma fictícia", "2026", "Escola Fictícia", "Matutino",
                anoEscolar, "Ativa");
        return new AlunoDto(id, "Aluno Fictício " + id, null, null, null, "1", null, "1", List.of(matricula));
    }

    private static PresencaDto presenca(String id, String alunoId, String dataHora, String leitorId) {
        return new PresencaDto(id, alunoId, dataHora, null, leitorId, null, null, null, null);
    }
}
