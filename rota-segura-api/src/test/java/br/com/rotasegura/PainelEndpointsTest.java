package br.com.rotasegura;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.alunos.integration.AlunosClient;
import br.com.rotasegura.alunos.integration.MatriculaDto;
import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.auth.domain.RegistroAuditoria;
import br.com.rotasegura.auth.domain.RegistroAuditoriaRepository;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.dispositivos.integration.DispositivosClient;
import br.com.rotasegura.presenca.integration.PresencaClient;
import br.com.rotasegura.presenca.integration.PresencaDto;
import br.com.rotasegura.responsaveis.integration.ResponsaveisClient;
import br.com.rotasegura.shared.erro.ApiExternaIndisponivelException;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.ResultadoCache;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/**
 * Endpoints do painel (Fase 2.2a) com a API externa simulada e banco real (Testcontainers).
 * Cenário fictício: escola 50 atendida pelo veículo 7, escola 60 pelo veículo 8.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(BancoDeTeste.class)
class PainelEndpointsTest {

    private static final String DIA = "2026-03-10";
    private static final Instant OBTIDO = Instant.parse("2026-03-10T10:00:00Z");

    @Autowired
    MockMvc mvc;
    @Autowired
    RegistroAuditoriaRepository auditoria;

    @MockitoBean
    AlunosClient alunos;
    @MockitoBean
    DispositivosClient dispositivos;
    @MockitoBean
    PresencaClient presencas;
    @MockitoBean
    ResponsaveisClient responsaveis;

    @BeforeEach
    void apiExternaFicticia() {
        when(dispositivos.listarTodos()).thenReturn(atual(List.of(
                leitor("11", "1", "7", "50"),
                leitor("21", "2", null, "50"),
                leitor("12", "1", "8", "60"),
                leitor("22", "2", null, "60"))));
        when(alunos.listarTodos()).thenReturn(atual(List.of(
                aluno("101", "1"), aluno("102", "1"), aluno("103", "0"))));
        when(alunos.buscarPorId(101)).thenReturn(new ResultadoCache<>(aluno("101", "1"), OBTIDO, false));
        when(presencas.listarTodas()).thenReturn(atual(List.of(
                presenca("1", "101", DIA + " 07:00:00", "11"),
                presenca("2", "101", DIA + " 07:25:00", "21"),
                presenca("3", "102", DIA + " 07:05:00", "12"),
                presenca("4", "102", DIA + " 07:40:00", "22"))));
    }

    @Test
    void gestaoVeTodasAsJornadasDoDiaComOTotalPorEstado() throws Exception {
        mvc.perform(get("/api/v1/jornadas").param("data", DIA).with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(DIA))
                .andExpect(jsonPath("$.jornadas.total").value(3))
                .andExpect(jsonPath("$.porEstado.NA_ESCOLA").value(2))
                .andExpect(jsonPath("$.jornadas.itens[*].aluno.id", containsInAnyOrder(101, 102, 103)));
    }

    @Test
    void diretorSoVeAEscolaDoEscopo() throws Exception {
        mvc.perform(get("/api/v1/jornadas").param("data", DIA).with(diretorDa(50)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jornadas.itens[*].aluno.id", contains(101)));
        mvc.perform(get("/api/v1/jornadas").param("data", DIA).param("escolaId", "60").with(diretorDa(50)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.type").value("urn:rota-segura:erro:acesso-negado"));
    }

    @Test
    void opcoesDeFiltroSoTrazemEscolasDoEscopoESemDadoDeAluno() throws Exception {
        mvc.perform(get("/api/v1/cadastro/opcoes-filtro").with(diretorDa(50)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.escolas[*].id", contains(50)))
                .andExpect(jsonPath("$.turmas.length()").value(1))
                .andExpect(jsonPath("$.etapas").isArray())
                .andExpect(jsonPath("$.turnos").isArray())
                .andExpect(jsonPath("$.alunos").doesNotExist());
    }

    @Test
    void monitorSoVeOVeiculoDoEscopo() throws Exception {
        mvc.perform(get("/api/v1/jornadas").param("data", DIA).with(monitorDo(8)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.jornadas.itens[*].aluno.id", contains(102)));
        mvc.perform(get("/api/v1/dispositivos/saude").with(monitorDo(8)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.leitores[*].id", contains(12)));
    }

    @Test
    void historicoDoAlunoRespeitaEscopoELimiteDeDias() throws Exception {
        mvc.perform(get("/api/v1/alunos/101/jornadas").param("inicio", DIA).param("fim", DIA)
                        .with(diretorDa(50)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].estado").value("NA_ESCOLA"))
                .andExpect(jsonPath("$[0].tempoTrajetoMin").value(25));
        mvc.perform(get("/api/v1/alunos/101/jornadas").param("inicio", DIA).param("fim", DIA)
                        .with(diretorDa(60)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/alunos/101/jornadas").param("inicio", "2026-01-01").param("fim", DIA)
                        .with(perfil("GESTAO")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.type").value("urn:rota-segura:erro:requisicao-invalida"));
    }

    @Test
    void perfilDoAlunoEhAuditadoENaoExpoeCpf() throws Exception {
        long antes = acessosAoPerfil();

        String corpo = mvc.perform(get("/api/v1/alunos/101/perfil").with(diretorDa(50)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aluno.id").value(101))
                .andExpect(jsonPath("$.aluno.iniciais").value("AF"))
                .andExpect(jsonPath("$.aluno.escolaId").value(50))
                .andExpect(jsonPath("$.situacaoResponsaveis.pronto").value(false))
                .andReturn().getResponse().getContentAsString();

        assertThat(corpo).doesNotContain("cpf").doesNotContain("000.000.000-00");
        assertThat(acessosAoPerfil()).isEqualTo(antes + 1);
        mvc.perform(get("/api/v1/alunos/101/perfil").with(diretorDa(60))).andExpect(status().isForbidden());
    }

    @Test
    void listaDeAlunosNoEscopoEBuscaPorNomeNoCorpo() throws Exception {
        mvc.perform(get("/api/v1/alunos").param("anoLetivo", anoAtual()).with(diretorDa(60)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alunos.itens[*].aluno.id", contains(102)));

        mvc.perform(post("/api/v1/alunos/busca").with(perfil("SECRETARIA"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termo\":\"FICTICIO 103\",\"anoLetivo\":" + anoAtual() + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alunos.itens[*].aluno.id", contains(103)));

        mvc.perform(post("/api/v1/alunos/busca").with(perfil("SECRETARIA"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"termo\":\"a\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void pendenciasApontamSemBiometriaENaoAfirmamSemResponsavelSemIndice() throws Exception {
        mvc.perform(get("/api/v1/cadastro/pendencias").param("anoLetivo", anoAtual()).with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.porTipo.SEM_BIOMETRIA").value(1))
                .andExpect(jsonPath("$.porTipo.SEM_RESPONSAVEL").value(0))
                .andExpect(jsonPath("$.responsaveisAvaliados").value(false))
                .andExpect(jsonPath("$.alunos.itens[*].aluno.id", contains(103)));
    }

    @Test
    void presencaNoPeriodoSoContaDiasLetivos() throws Exception {
        mvc.perform(get("/api/v1/presenca/periodo").param("dataInicio", "2026-03-09").param("dataFim", "2026-03-15")
                        .with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dias", hasSize(5)))
                .andExpect(jsonPath("$.dias[1].data").value(DIA))
                .andExpect(jsonPath("$.dias[1].presentes").value(2));
    }

    @Test
    void presencaDeHojeResponde() throws Exception {
        mvc.perform(get("/api/v1/presenca/hoje").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.contagem").exists());
    }

    @Test
    void sincronizarExigePerfilDeGestaoERegistraOResultado() throws Exception {
        mvc.perform(post("/api/v1/alunos/sincronizar").with(monitorDo(8))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/alunos/sincronizar").with(diretorDa(50))).andExpect(status().isForbidden());

        when(alunos.sincronizar()).thenReturn(200);
        mvc.perform(post("/api/v1/alunos/sincronizar").with(perfil("SECRETARIA")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sucesso").value(true))
                .andExpect(jsonPath("$.httpStatus").value(200))
                .andExpect(jsonPath("$.usuarioId").value(1));
        verify(alunos).sincronizar();

        when(alunos.sincronizar()).thenThrow(new ApiExternaIndisponivelException("ALUNOS", null));
        mvc.perform(post("/api/v1/alunos/sincronizar").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sucesso").value(false))
                .andExpect(jsonPath("$.erroTipo").value("ApiExternaIndisponivelException"));
        mvc.perform(get("/api/v1/alunos/sincronizacao/ultima").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sucesso").value(false));

        assertThat(auditoria.findByAcaoOrderByOcorridoEmDesc(AcaoAuditoria.SINCRONIZACAO_ALUNOS)).hasSizeGreaterThan(1);
    }

    @Test
    void paginaForaDoLimiteViraProblemDetail() throws Exception {
        mvc.perform(get("/api/v1/jornadas").param("data", DIA).param("tamanho", "500").with(perfil("GESTAO")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void semTokenNaoEntra() throws Exception {
        mvc.perform(get("/api/v1/jornadas")).andExpect(status().isUnauthorized());
    }

    private long acessosAoPerfil() {
        return auditoria.findByAcaoOrderByOcorridoEmDesc(AcaoAuditoria.ACESSO_PERFIL_ALUNO).stream()
                .map(RegistroAuditoria::getEntidadeId).filter("101"::equals).count();
    }

    private static String anoAtual() {
        return String.valueOf(LocalDate.now(ZoneId.of("America/Sao_Paulo")).getYear());
    }

    private static RequestPostProcessor perfil(String perfil) {
        return token(perfil, List.of(), List.of());
    }

    private static RequestPostProcessor diretorDa(long escola) {
        return token("DIRETOR", List.of(escola), List.of());
    }

    private static RequestPostProcessor monitorDo(long veiculo) {
        return token("MONITOR", List.of(), List.of(veiculo));
    }

    private static RequestPostProcessor token(String perfil, List<Long> escolas, List<Long> veiculos) {
        return jwt().jwt(j -> j.subject("1").claim("perfil", perfil).claim("escolas", escolas)
                        .claim("veiculos", veiculos))
                .authorities(new SimpleGrantedAuthority("ROLE_" + perfil));
    }

    private static <T> ResultadoCache<ColecaoPaginada<T>> atual(List<T> itens) {
        return new ResultadoCache<>(new ColecaoPaginada<>(itens, 1, false), OBTIDO, false);
    }

    private static DispositivoFacialDto leitor(String id, String tipo, String veiculoId, String escolaId) {
        return new DispositivoFacialDto(id, "Leitor fictício " + id, veiculoId, "00:00:00:00:00:00", "P-" + id,
                "R-" + id, tipo, "Tipo fictício", "-10.0", "-50.0", escolaId);
    }

    /** Matrícula em 2026 (dia do cenário) e no ano corrente, para a lista de alunos do ano. */
    private static AlunoDto aluno(String id, String biometria) {
        List<MatriculaDto> matriculas = Stream.of("2026", anoAtual()).distinct()
                .map(ano -> new MatriculaDto("900", "Turma fictícia", ano, "Escola Fictícia", "Matutino", "1º ano",
                        "Ativa"))
                .toList();
        return new AlunoDto(id, "Aluno Fictício " + id, "000.000.000-00", null, null, "1", null, biometria,
                matriculas);
    }

    private static PresencaDto presenca(String id, String alunoId, String dataHora, String leitorId) {
        return new PresencaDto(id, alunoId, dataHora, null, leitorId, null, null, null, null);
    }
}
