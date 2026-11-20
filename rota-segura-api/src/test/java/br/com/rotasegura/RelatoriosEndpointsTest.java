package br.com.rotasegura;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.asyncDispatch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.alunos.integration.AlunosClient;
import br.com.rotasegura.alunos.integration.MatriculaDto;
import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.auth.domain.RegistroAuditoriaRepository;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.dispositivos.integration.DispositivosClient;
import br.com.rotasegura.presenca.integration.PresencaClient;
import br.com.rotasegura.presenca.integration.PresencaDto;
import br.com.rotasegura.responsaveis.integration.ResponsaveisClient;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.ResultadoCache;
import br.com.rotasegura.veiculos.integration.VeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculosClient;
import java.nio.charset.StandardCharsets;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

/** Relatórios (Fase 4.3) com dados fictícios: dois dias letivos (09 e 10/03/2026), escolas 50 e 60. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(BancoDeTeste.class)
class RelatoriosEndpointsTest {

    private static final Instant AGORA = Instant.parse("2026-03-10T15:00:00Z");

    @Autowired
    MockMvc mvc;
    @Autowired
    RegistroAuditoriaRepository auditoria;

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
        doReturn(AGORA).when(relogio).instant();
        doReturn(AGORA.toEpochMilli()).when(relogio).millis();
        doReturn(ZoneOffset.UTC).when(relogio).getZone();
        when(veiculos.listarTodos()).thenReturn(atual(List.of(
                new VeiculoDto("7", "AAA0A07", "Marca", "Modelo", "R-7", null, "Branco", "P-07"))));
        when(dispositivos.listarTodos()).thenReturn(atual(List.of(
                leitor("11", "1", "7", "50"), leitor("21", "2", null, "50"), leitor("22", "2", null, "60"))));
        when(alunos.listarTodos()).thenReturn(atual(List.of(aluno("101"), aluno("102"), aluno("201"))));
        when(presencas.listarTodas()).thenReturn(atual(List.of(
                presenca("1", "101", "2026-03-09 07:00:00", "11"),
                presenca("2", "101", "2026-03-09 07:20:00", "21"),
                presenca("3", "101", "2026-03-10 07:00:00", "11"),
                presenca("4", "101", "2026-03-10 07:22:00", "21"),
                presenca("5", "102", "2026-03-10 07:01:00", "11"),
                presenca("6", "102", "2026-03-10 07:25:00", "21"),
                presenca("7", "201", "2026-03-10 07:30:00", "22"))));
    }

    @Test
    void previaSemDatasUsaUltimosSeteDias() throws Exception {
        mvc.perform(post("/api/v1/relatorios/previa").with(perfil("GESTAO"))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tabela.periodo").value("04/03/2026 a 10/03/2026"))
                .andExpect(jsonPath("$.tabela.colunas[8]").value("Frequência (%)"))
                .andExpect(jsonPath("$.totalLinhas").value(3));
    }

    @Test
    void csvTemBomEAuditaAExportacao() throws Exception {
        long antes = auditoria.count();
        MvcResult inicio = mvc.perform(get("/api/v1/relatorios/frequencia.csv")
                        .param("dataInicio", "2026-03-09").param("dataFim", "2026-03-10").with(perfil("GESTAO")))
                .andExpect(request().asyncStarted())
                .andReturn();
        MvcResult resultado = concluir(inicio)
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition",
                        "attachment; filename=\"frequencia_2026-03-09_2026-03-10.csv\""))
                // Cabeçalhos de segurança gravados uma vez, na thread da requisição (sem corrida com o streaming).
                .andExpect(header().stringValues("Cache-Control", "no-cache, no-store, max-age=0, must-revalidate"))
                .andExpect(header().exists("Content-Security-Policy"))
                .andReturn();
        byte[] corpo = resultado.getResponse().getContentAsByteArray();
        assertThat(corpo[0]).isEqualTo((byte) 0xEF);
        String csv = new String(corpo, StandardCharsets.UTF_8);
        assertThat(csv).contains("101;Aluno Fictício 101").contains(";2;2;0;100.0");
        assertThat(csv).contains("102;Aluno Fictício 102").contains(";2;1;1;50.0");

        assertThat(auditoria.count()).isEqualTo(antes + 1);
        assertThat(auditoria.findAll()).anySatisfy(r -> {
            assertThat(r.getAcao()).isEqualTo(AcaoAuditoria.EXPORTACAO);
            assertThat(r.getEntidade()).isEqualTo("relatorio-frequencia");
        });
    }

    @Test
    void diretorSoExportaSuasEscolas() throws Exception {
        MvcResult inicio = mvc.perform(get("/api/v1/relatorios/frequencia.csv").with(token("DIRETOR", List.of(60L))))
                .andReturn();
        String csv = concluir(inicio).andReturn().getResponse()
                .getContentAsString(StandardCharsets.UTF_8);
        assertThat(csv).contains("201;").doesNotContain("101;").doesNotContain("102;");

        mvc.perform(get("/api/v1/relatorios/frequencia.csv").param("escolaId", "50")
                        .with(token("DIRETOR", List.of(60L))))
                .andExpect(status().isForbidden());
    }

    @Test
    void pdfEVeiculosSaoGerados() throws Exception {
        MvcResult inicio = mvc.perform(get("/api/v1/relatorios/veiculos.pdf").with(perfil("GESTAO"))).andReturn();
        byte[] pdf = concluir(inicio)
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(pdf, 0, 5, StandardCharsets.US_ASCII)).isEqualTo("%PDF-");

        mvc.perform(post("/api/v1/relatorios/previa").with(perfil("GESTAO"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"tipo\":\"VEICULOS\"}"))
                .andExpect(jsonPath("$.tabela.linhas[0][1]").value("AAA0A07"))
                .andExpect(jsonPath("$.tabela.linhas[0][3]").value("2"))
                .andExpect(jsonPath("$.tabela.linhas[0][4]").value("3"));
    }

    @Test
    void periodoInvalidoRetorna400() throws Exception {
        mvc.perform(post("/api/v1/relatorios/previa").with(perfil("GESTAO"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dataInicio\":\"2026-01-01\",\"dataFim\":\"2026-06-01\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void agendamentoEDoProprioUsuario() throws Exception {
        String corpo = mvc.perform(post("/api/v1/relatorios/agendados").with(perfil("GESTAO"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"diaSemana\":\"FRIDAY\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tipo").value("FREQUENCIA"))
                .andReturn().getResponse().getContentAsString();
        long id = Long.parseLong(corpo.replaceAll(".*\"id\":(\\d+).*", "$1"));

        mvc.perform(delete("/api/v1/relatorios/agendados/" + id).with(jwt().jwt(j -> j.subject("999")
                                .claim("perfil", "GESTAO").claim("escolas", List.of()).claim("veiculos", List.of()))
                        .authorities(new SimpleGrantedAuthority("ROLE_GESTAO"))))
                .andExpect(status().isForbidden());
        mvc.perform(delete("/api/v1/relatorios/agendados/" + id).with(perfil("GESTAO")))
                .andExpect(status().isNoContent());
    }

    /** Espera o corpo em streaming terminar antes do dispatch (evita corrida no MockMvc). */
    private org.springframework.test.web.servlet.ResultActions concluir(MvcResult inicio) throws Exception {
        inicio.getAsyncResult(10_000);
        return mvc.perform(asyncDispatch(inicio));
    }

    private static RequestPostProcessor perfil(String perfil) {
        return token(perfil, List.of());
    }

    private static RequestPostProcessor token(String perfil, List<Long> escolas) {
        return jwt().jwt(j -> j.subject("1").claim("perfil", perfil).claim("escolas", escolas)
                        .claim("veiculos", List.of()))
                .authorities(new SimpleGrantedAuthority("ROLE_" + perfil));
    }

    private static <T> ResultadoCache<ColecaoPaginada<T>> atual(List<T> itens) {
        return new ResultadoCache<>(new ColecaoPaginada<>(itens, 1, false), AGORA, false);
    }

    private static DispositivoFacialDto leitor(String id, String tipo, String veiculoId, String escolaId) {
        return new DispositivoFacialDto(id, "Leitor fictício " + id, veiculoId, "00:00:00:00:00:00", "P-" + id,
                "R-" + id, tipo, "Tipo fictício", "-10.0", "-50.0", escolaId);
    }

    private static AlunoDto aluno(String id) {
        MatriculaDto matricula = new MatriculaDto("9" + id, "Turma fictícia", "2026", "Escola Fictícia", "Matutino",
                "1º ano", "Ativa");
        return new AlunoDto(id, "Aluno Fictício " + id, null, null, null, "1", null, "1", List.of(matricula));
    }

    private static PresencaDto presenca(String id, String alunoId, String dataHora, String leitorId) {
        return new PresencaDto(id, alunoId, dataHora, null, leitorId, null, null, null, null);
    }
}
