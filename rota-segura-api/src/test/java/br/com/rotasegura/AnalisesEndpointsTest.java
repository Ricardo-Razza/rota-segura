package br.com.rotasegura;

import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rotasegura.alertas.domain.Alerta;
import br.com.rotasegura.alertas.domain.AlertaRepository;
import br.com.rotasegura.alertas.domain.EntidadeAlerta;
import br.com.rotasegura.alertas.domain.Ocorrencia;
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
import br.com.rotasegura.veiculos.integration.VeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculosClient;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Análises com relógio fixo na sexta, 13/03/2026, 15:00 em Brasília. Cenário fictício de uma semana:
 * <ul>
 *   <li>101 (Pré II) embarca no veículo 7 e chega na escola 50 todos os dias, 25 min de trajeto;</li>
 *   <li>103 (1º ano) embarca no 7 na segunda (chega em 30 min) e na terça (não chega); depois falta;</li>
 *   <li>102 (1º ano) só passa no leitor da escola 60 na segunda (escola 60 só tem leitura nesse dia).</li>
 * </ul>
 */
@SpringBootTest(properties = {
        "rota-segura.dashboard.etapas.INFANTIL[0]=Pré II",
        "rota-segura.dashboard.etapas.FUNDAMENTAL[0]=1º ano",
        "rota-segura.alertas.avaliacao-habilitada=false"})
@AutoConfigureMockMvc
@Import(BancoDeTeste.class)
class AnalisesEndpointsTest {

    private static final Instant AGORA = Instant.parse("2026-03-13T18:00:00Z");
    private static final String SEMANA = "dataInicio=2026-03-09&dataFim=2026-03-13";
    private static final String[] DIAS = {"09", "10", "11", "12", "13"};

    @Autowired
    MockMvc mvc;
    @Autowired
    AlertaRepository alertas;

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
        doReturn(AGORA).when(relogio).instant();
        doReturn(AGORA.toEpochMilli()).when(relogio).millis();
        doReturn(ZoneOffset.UTC).when(relogio).getZone();

        when(veiculos.listarTodos()).thenReturn(atual(List.of(
                new VeiculoDto("7", "AAA0A07", "Marca", "Modelo", "R-7", null, "Branco", "P-07"),
                new VeiculoDto("8", "BBB0B08", "Marca", "Modelo", "R-8", null, "Branco", "P-08"))));
        when(dispositivos.listarTodos()).thenReturn(atual(List.of(
                leitor("11", "1", "7", "50"), leitor("21", "2", null, "50"),
                leitor("12", "1", "8", "60"), leitor("22", "2", null, "60"))));
        when(alunos.listarTodos()).thenReturn(atual(List.of(
                aluno("101", "Pré II"), aluno("102", "1º ano"), aluno("103", "1º ano"))));

        List<PresencaDto> leituras = new ArrayList<>();
        int n = 1;
        for (String dia : DIAS) {
            leituras.add(presenca(n++, "101", dia, "07:00:00", "11"));
            leituras.add(presenca(n++, "101", dia, "07:25:00", "21"));
        }
        leituras.add(presenca(n++, "103", "09", "07:00:00", "11"));
        leituras.add(presenca(n++, "103", "09", "07:30:00", "21"));
        leituras.add(presenca(n++, "103", "10", "07:00:00", "11"));
        leituras.add(presenca(n, "102", "09", "07:10:00", "22"));
        when(presencas.listarTodas()).thenReturn(atual(leituras));

        alertas.save(Alerta.abrir(new Ocorrencia(TipoAlerta.EMBARCOU_SEM_CHEGADA, Severidade.CRITICO,
                EntidadeAlerta.ALUNO, "103", "#103", "2026-03-10", "Aluno #103 embarcou e não chegou.", 50L, 7L),
                Instant.parse("2026-03-10T11:00:00Z")));
        // Fora do período: não conta.
        alertas.save(Alerta.abrir(new Ocorrencia(TipoAlerta.EMBARCOU_SEM_CHEGADA, Severidade.CRITICO,
                EntidadeAlerta.ALUNO, "103", "#103", "2026-02-10", "Aluno #103 embarcou e não chegou.", 50L, 7L),
                Instant.parse("2026-02-10T11:00:00Z")));
    }

    @Test
    void frequenciaCalculaCadaEtapaEEscolaSeparadamente() throws Exception {
        mvc.perform(get("/api/v1/analises/frequencia?" + SEMANA + "&comparar=NENHUMA").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.granularidade").value("DIA"))
                // 101: 5/5, 103: 1/5 (escola 50, 5 dias com leitura); 102: 1/1 (escola 60, só segunda).
                .andExpect(jsonPath("$.frequencia.atual").value(63.6))
                .andExpect(jsonPath("$.frequencia.anterior").doesNotExist())
                .andExpect(jsonPath("$.alunosAvaliados").value(3))
                .andExpect(jsonPath("$.diasLetivos").value(5))
                .andExpect(jsonPath("$.abaixoDoLimite.atual").value(1))
                .andExpect(jsonPath("$.serie.length()").value(5))
                .andExpect(jsonPath("$.serie[0].frequencia").value(100.0))
                .andExpect(jsonPath("$.serie[1].frequencia").value(50.0))
                .andExpect(jsonPath("$.porEtapa[?(@.chave=='INFANTIL')].frequencia").value(100.0))
                .andExpect(jsonPath("$.porEtapa[?(@.chave=='FUNDAMENTAL')].frequencia").value(33.3))
                .andExpect(jsonPath("$.porEscola[0].chave").value("60"))
                .andExpect(jsonPath("$.porEscola[1].frequencia").value(60.0))
                .andExpect(jsonPath("$.porEscola[1].faixa").value("ATENCAO"))
                .andExpect(jsonPath("$.porDiaSemana[0].rotulo").value("Seg"));
    }

    @Test
    void filtrosDeEscolaEEtapaRecortamOsAlunos() throws Exception {
        mvc.perform(get("/api/v1/analises/frequencia?" + SEMANA + "&escolaIds=50&etapa=fundamental")
                        .with(perfil("GESTAO")))
                .andExpect(jsonPath("$.alunosAvaliados").value(1))
                .andExpect(jsonPath("$.frequencia.atual").value(20.0));
    }

    @Test
    void comparaComOPeriodoAnterior() throws Exception {
        mvc.perform(get("/api/v1/analises/frequencia?" + SEMANA).with(perfil("GESTAO")))
                .andExpect(jsonPath("$.referencia.inicio").value("2026-03-04"))
                .andExpect(jsonPath("$.referencia.fim").value("2026-03-08"))
                .andExpect(jsonPath("$.serieReferencia.length()").value(5))
                .andExpect(jsonPath("$.frequencia.variacao").doesNotExist());
        mvc.perform(get("/api/v1/analises/frequencia?" + SEMANA + "&comparar=ANO_ANTERIOR").with(perfil("GESTAO")))
                .andExpect(jsonPath("$.referencia.inicio").value("2025-03-09"));
    }

    @Test
    void periodoLongoAgrupaPorSemanaOuMesEValida() throws Exception {
        mvc.perform(get("/api/v1/analises/frequencia?dataInicio=2026-01-01&dataFim=2026-03-13&comparar=NENHUMA")
                        .with(perfil("GESTAO")))
                .andExpect(jsonPath("$.granularidade").value("SEMANA"));
        mvc.perform(get("/api/v1/analises/frequencia?dataInicio=2025-06-01&dataFim=2026-03-13&comparar=NENHUMA")
                        .with(perfil("GESTAO")))
                .andExpect(jsonPath("$.granularidade").value("MES"))
                .andExpect(jsonPath("$.frequencia.atual").value(63.6));
        mvc.perform(get("/api/v1/analises/frequencia?dataInicio=2024-01-01&dataFim=2026-03-13")
                        .with(perfil("GESTAO")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void diretorSoVeASuaEscola() throws Exception {
        mvc.perform(get("/api/v1/analises/frequencia?" + SEMANA).with(token("DIRETOR", List.of(60L), List.of())))
                .andExpect(jsonPath("$.alunosAvaliados").value(1))
                .andExpect(jsonPath("$.porEscola.length()").value(1))
                .andExpect(jsonPath("$.porEscola[0].chave").value("60"));
        mvc.perform(get("/api/v1/analises/frequencia?" + SEMANA + "&escolaIds=50")
                        .with(token("DIRETOR", List.of(60L), List.of())))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/analises/frota?" + SEMANA).with(token("DIRETOR", List.of(60L), List.of())))
                .andExpect(jsonPath("$.embarques.atual").value(0))
                .andExpect(jsonPath("$.alertas.total.atual").value(0));
    }

    @Test
    void frotaMedeTrajetoPontualidadeEAlertasDoPeriodo() throws Exception {
        mvc.perform(get("/api/v1/analises/frota?" + SEMANA + "&comparar=NENHUMA").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.janelaMin").value(40))
                .andExpect(jsonPath("$.embarques.atual").value(7))
                .andExpect(jsonPath("$.viagens.atual").value(5))
                // (5 × 25 + 30) / 6 chegadas
                .andExpect(jsonPath("$.tempoMedioMin.atual").value(25.8))
                .andExpect(jsonPath("$.noPrazo.atual").value(100.0))
                .andExpect(jsonPath("$.veiculos.length()").value(1))
                .andExpect(jsonPath("$.veiculos[0].placa").value("AAA0A07"))
                .andExpect(jsonPath("$.veiculos[0].semChegada").value(1))
                .andExpect(jsonPath("$.veiculos[0].alertas").value(1))
                .andExpect(jsonPath("$.alertas.total.atual").value(1))
                .andExpect(jsonPath("$.alertas.abertos").value(1))
                .andExpect(jsonPath("$.alertas.porSeveridade.CRITICO").value(1))
                .andExpect(jsonPath("$.serie[1].alertas").value(1));

        mvc.perform(get("/api/v1/analises/frota?" + SEMANA).with(token("MONITOR", List.of(), List.of(8L))))
                .andExpect(jsonPath("$.embarques.atual").value(0));
        mvc.perform(get("/api/v1/analises/frota?" + SEMANA + "&veiculoId=7")
                        .with(token("MONITOR", List.of(), List.of(8L))))
                .andExpect(status().isForbidden());
    }

    @Test
    void matriculasEComparacaoComOAnoAnterior() throws Exception {
        mvc.perform(get("/api/v1/analises/matriculas").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.anoLetivo").value(2026))
                .andExpect(jsonPath("$.agrupamento").value("ETAPA"))
                .andExpect(jsonPath("$.total.atual").value(3))
                .andExpect(jsonPath("$.total.anterior").value(0))
                .andExpect(jsonPath("$.total.variacao").doesNotExist())
                .andExpect(jsonPath("$.porAno[0].ano").value(2026))
                .andExpect(jsonPath("$.porAno[0].porGrupo.FUNDAMENTAL").value(2))
                .andExpect(jsonPath("$.porAnoEscolar.length()").value(2))
                .andExpect(jsonPath("$.cobertura[?(@.chave=='BIOMETRIA')].percentual").value(100.0))
                .andExpect(jsonPath("$.cobertura[?(@.chave=='VEICULO')].com").value(2));
    }

    private static RequestPostProcessor perfil(String perfil) {
        return token(perfil, List.of(), List.of());
    }

    private static RequestPostProcessor token(String perfil, List<Long> escolas, List<Long> veiculos) {
        return jwt().jwt(j -> j.subject("1").claim("perfil", perfil).claim("escolas", escolas)
                        .claim("veiculos", veiculos))
                .authorities(new SimpleGrantedAuthority("ROLE_" + perfil));
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

    private static PresencaDto presenca(int id, String alunoId, String dia, String hora, String leitorId) {
        return new PresencaDto(String.valueOf(id), alunoId, "2026-03-" + dia + " " + hora, null, leitorId, null, null,
                null, null);
    }
}
