package br.com.rotasegura;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rotasegura.alertas.application.CicloDeOperacao;
import br.com.rotasegura.alertas.domain.Alerta;
import br.com.rotasegura.alertas.domain.AlertaRepository;
import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.alunos.integration.AlunosClient;
import br.com.rotasegura.alunos.integration.MatriculaDto;
import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.auth.domain.RegistroAuditoriaRepository;
import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.dispositivos.integration.DispositivosClient;
import br.com.rotasegura.jornada.domain.Severidade;
import br.com.rotasegura.presenca.integration.PresencaClient;
import br.com.rotasegura.presenca.integration.PresencaDto;
import br.com.rotasegura.responsaveis.integration.ResponsaveisClient;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.ResultadoCache;
import br.com.rotasegura.veiculos.application.HistoricoDeRotasService;
import br.com.rotasegura.veiculos.application.RastreamentoService;
import br.com.rotasegura.veiculos.domain.PontoRastroSalvo;
import br.com.rotasegura.veiculos.domain.PontoRastroSalvoRepository;
import br.com.rotasegura.veiculos.integration.DadosVeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculoDto;
import br.com.rotasegura.veiculos.integration.VeiculosClient;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
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
 * Replay, paradas aprendidas, previsão pelo GPS e alertas de trajeto, com dados fictícios.
 * <p>
 * Veículo 8 leva à escola 60 (-10.0, -50.0). Nos dias letivos 03, 04, 05, 06 e 09/03/2026 ele fez a mesma rota:
 * saiu às 06:50 de (-10.020, -50.0) e andou ~111 m por minuto para o norte até a escola (07:10), entrando na cerca
 * (300 m) às 07:08. Embarques todo dia: aluno 102 às 06:50 no início e aluno 103 às 06:58 em (-10.012).
 * Hoje (terça, 10/03) o 102 embarcou às 06:50 e está a bordo.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(BancoDeTeste.class)
class RotasEndpointsTest {

    private static final String DIA = "2026-03-10";
    private static final List<Integer> DIAS_ANTERIORES = List.of(3, 4, 5, 6, 9);
    private static final Instant AGORA = Instant.parse(DIA + "T10:10:00Z");

    @Autowired
    MockMvc mvc;
    @Autowired
    CicloDeOperacao ciclo;
    @Autowired
    AlertaRepository alertas;
    @Autowired
    RastreamentoService rastreamento;
    @Autowired
    HistoricoDeRotasService historico;
    @Autowired
    PontoRastroSalvoRepository trajetos;
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
        alertas.deleteAll();
        trajetos.deleteAll();
        rastreamento.reiniciar();
        historico.reiniciar();
        relogioEm("T10:10:00Z");
        doReturn(ZoneOffset.UTC).when(relogio).getZone();

        when(veiculos.listarTodos()).thenReturn(atual(List.of(
                new VeiculoDto("7", "AAA0A07", "Marca", "Modelo", null, null, "Branco", "P-07"),
                new VeiculoDto("8", "BBB0B08", "Marca", "Modelo", "R-8", null, "Branco", "P-08"))));
        when(dispositivos.listarTodos()).thenReturn(atual(List.of(
                leitor("11", "1", "7", "50"), leitor("21", "2", null, "50"),
                leitor("12", "1", "8", "60"), leitor("22", "2", null, "60"))));
        when(alunos.listarTodos()).thenReturn(atual(List.of(aluno("102"), aluno("103"))));

        List<PresencaDto> leituras = new ArrayList<>();
        int id = 1;
        for (int dia : DIAS_ANTERIORES) {
            String data = LocalDate.of(2026, 3, dia).toString();
            leituras.add(presenca(String.valueOf(id++), "102", data + " 06:50:00", "12"));
            leituras.add(presenca(String.valueOf(id++), "103", data + " 06:58:00", "12"));
            leituras.add(presenca(String.valueOf(id++), "102", data + " 07:12:00", "22"));
            leituras.add(presenca(String.valueOf(id++), "103", data + " 07:20:00", "22"));
            for (int minuto = 0; minuto <= 20; minuto++) {
                trajetos.save(new PontoRastroSalvo(8, LocalDateTime.of(2026, 3, dia, 6, 50).plusMinutes(minuto),
                        -10.020 + minuto * 0.001, -50.0));
            }
        }
        leituras.add(presenca(String.valueOf(id), "102", DIA + " 06:50:00", "12"));
        when(presencas.listarTodas()).thenReturn(atual(leituras));
    }

    @AfterEach
    void limpar() {
        trajetos.deleteAll();
        historico.reiniciar();
    }

    @Test
    void trajetoDoDiaTrazPontosEmbarquesSemAlunoEEscolaEAudita() throws Exception {
        long antes = auditoria.count();
        mvc.perform(get("/api/v1/veiculos/8/trajeto").param("data", "2026-03-09").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value("2026-03-09"))
                .andExpect(jsonPath("$.pontos.length()").value(21))
                .andExpect(jsonPath("$.embarques.length()").value(2))
                .andExpect(jsonPath("$.embarques[0].em").value(containsString("06:50")))
                .andExpect(jsonPath("$.embarques[0].latitude").value(-10.02))
                .andExpect(jsonPath("$.embarques[1].latitude").value(-10.012))
                .andExpect(jsonPath("$.embarques[0].alunoId").doesNotExist())
                .andExpect(jsonPath("$.escola.escolaId").value(60))
                .andExpect(jsonPath("$.escola.raioM").value(300));
        assertThat(auditoria.count()).isEqualTo(antes + 1);
        assertThat(auditoria.findAll()).anySatisfy(r -> {
            assertThat(r.getAcao()).isEqualTo(AcaoAuditoria.ACESSO_LOCAL_EMBARQUE);
            assertThat(r.getEntidade()).isEqualTo("veiculo");
        });

        mvc.perform(get("/api/v1/veiculos/8/trajeto").param("data", "2026-03-08").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pontos.length()").value(0));
        mvc.perform(get("/api/v1/veiculos/8/trajeto").param("data", "2026-03-11").with(perfil("GESTAO")))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/veiculos/99/trajeto").with(perfil("GESTAO")))
                .andExpect(status().isNotFound());
    }

    @Test
    void trajetoEParadasRespeitamOEscopo() throws Exception {
        mvc.perform(get("/api/v1/veiculos/8/trajeto").with(token("MONITOR", List.of(), List.of(7L))))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/veiculos/8/paradas").with(token("DIRETOR", List.of(50L), List.of())))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/veiculos/8/trajeto").with(token("DIRETOR", List.of(60L), List.of())))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/veiculos/8/paradas").with(token("MONITOR", List.of(), List.of(8L))))
                .andExpect(status().isOk());
    }

    @Test
    void paradasAprendidasComHorarioTipicoSemAluno() throws Exception {
        mvc.perform(get("/api/v1/veiculos/8/paradas").with(perfil("GESTAO")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diasAnalisados").value(5))
                .andExpect(jsonPath("$.embarquesLocalizados").value(10))
                .andExpect(jsonPath("$.paradas.length()").value(2))
                .andExpect(jsonPath("$.paradas[0].latitude").value(-10.02))
                .andExpect(jsonPath("$.paradas[0].embarques").value(5))
                .andExpect(jsonPath("$.paradas[0].alunos").value(1))
                .andExpect(jsonPath("$.paradas[0].dias").value(5))
                .andExpect(jsonPath("$.paradas[0].horariosTipicos[0]").value(containsString("06:50")))
                .andExpect(jsonPath("$.paradas[1].latitude").value(-10.012))
                .andExpect(jsonPath("$.paradas[0].alunoId").doesNotExist());
    }

    @Test
    void previsaoPeloGpsDizQuantoPassaDoNormal() throws Exception {
        // 07:10, ônibus em (-10.015): nos dias anteriores ele passou ali às 06:55 e entrou na cerca às 07:08 (13 min).
        when(veiculos.dados(8)).thenReturn(gps(-10.015, -50.0, DIA + "T07:09:55-03:00"));
        rastreamento.atualizar();

        mvc.perform(get("/api/v1/veiculos/status").with(perfil("GESTAO")))
                .andExpect(jsonPath("$.veiculos[1].placa").value("BBB0B08"))
                .andExpect(jsonPath("$.veiculos[1].estado").value("EM_ROTA"))
                .andExpect(jsonPath("$.veiculos[1].origemPrevisao").value("GPS"))
                .andExpect(jsonPath("$.veiculos[1].previsaoChegada").value(containsString("07:23")))
                .andExpect(jsonPath("$.veiculos[1].chegadaNormal").value(containsString("07:08")))
                .andExpect(jsonPath("$.veiculos[1].diferencaMin").value(15));
    }

    @Test
    void semGpsAPrevisaoContinuaPelaSaida() throws Exception {
        mvc.perform(get("/api/v1/veiculos/status").with(perfil("GESTAO")))
                .andExpect(jsonPath("$.veiculos[1].origemPrevisao").value("SAIDA"))
                // Saída 06:50 + mediana de 22 min de trajeto.
                .andExpect(jsonPath("$.veiculos[1].previsaoChegada").value(containsString("07:12")))
                .andExpect(jsonPath("$.veiculos[1].diferencaMin").doesNotExist());
    }

    @Test
    void desvioDeRotaComAlunoABordoGeraAlerta() {
        andar("T10:04:00Z", -10.015, -50.0, "07:03:58");
        // ~650 m a leste do caminho habitual desde 07:05:58.
        andar("T10:06:00Z", -10.015, -50.006, "07:05:58");
        andar("T10:10:00Z", -10.014, -50.007, "07:09:55");

        ciclo.executar();
        Alerta desvio = alertas.findByChave("DESVIO_DE_ROTA:VEICULO:8:" + DIA).orElseThrow();
        assertThat(desvio.getSeveridade()).isEqualTo(Severidade.ATENCAO);
        assertThat(desvio.getEntidadeRotulo()).isEqualTo("BBB0B08");
        assertThat(desvio.getMensagem()).contains("BBB0B08").contains("07:05").contains("1 aluno a bordo")
                .contains("5 dias letivos").doesNotContain("Fictício");
        assertThat(alertas.findByChave("PARADA_FORA_DO_PADRAO:VEICULO:8:" + DIA)).isEmpty();

        ciclo.executar();
        assertThat(alertas.findAll()).filteredOn(a -> a.getChave().startsWith("DESVIO_DE_ROTA")).hasSize(1);
    }

    @Test
    void desvioCurtoOuSemHistoricoNaoAlerta() {
        andar("T10:09:00Z", -10.015, -50.0, "07:08:58");
        andar("T10:10:00Z", -10.015, -50.006, "07:09:55");
        ciclo.executar();
        assertThat(alertas.findByChave("DESVIO_DE_ROTA:VEICULO:8:" + DIA)).as("só 5 s fora").isEmpty();

        trajetos.deleteAll();
        historico.reiniciar();
        rastreamento.reiniciar();
        andar("T10:04:00Z", -10.015, -50.006, "07:03:58");
        andar("T10:10:00Z", -10.014, -50.007, "07:09:55");
        ciclo.executar();
        assertThat(alertas.findByChave("DESVIO_DE_ROTA:VEICULO:8:" + DIA)).as("sem caminho habitual").isEmpty();
    }

    @Test
    void paradaLongaForaDasParadasConhecidasGeraAlerta() {
        // No caminho, mas a ~440 m das duas paradas aprendidas, parado desde 07:03.
        andar("T10:03:00Z", -10.016, -50.0, "07:03:00");
        andar("T10:10:00Z", -10.01601, -50.0, "07:09:55");

        ciclo.executar();
        Alerta parada = alertas.findByChave("PARADA_FORA_DO_PADRAO:VEICULO:8:" + DIA).orElseThrow();
        assertThat(parada.getMensagem()).contains("BBB0B08").contains("parado desde 07:03").contains("7 min")
                .contains("m da parada conhecida mais perto");
        assertThat(alertas.findByChave("DESVIO_DE_ROTA:VEICULO:8:" + DIA)).isEmpty();
    }

    @Test
    void paradoNumaParadaConhecidaNaoAlerta() {
        andar("T10:03:00Z", -10.012, -50.0, "07:03:00");
        andar("T10:10:00Z", -10.01201, -50.0, "07:09:55");
        ciclo.executar();
        assertThat(alertas.findByChave("PARADA_FORA_DO_PADRAO:VEICULO:8:" + DIA)).isEmpty();
    }

    private void andar(String horaUtc, double latitude, double longitude, String horaGps) {
        relogioEm(horaUtc);
        when(veiculos.dados(8)).thenReturn(gps(latitude, longitude, DIA + "T" + horaGps + "-03:00"));
        rastreamento.atualizar();
    }

    private void relogioEm(String horaUtc) {
        Instant instante = Instant.parse(DIA + horaUtc);
        doReturn(instante).when(relogio).instant();
        doReturn(instante.toEpochMilli()).when(relogio).millis();
    }

    private static DadosVeiculoDto gps(double latitude, double longitude, String fixTime) {
        return new DadosVeiculoDto(new DadosVeiculoDto.LocalizacaoDto(latitude, longitude, 0.0, 0.0, fixTime, true,
                new DadosVeiculoDto.Atributos(false)));
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

    private static AlunoDto aluno(String id) {
        MatriculaDto matricula = new MatriculaDto("9" + id, "Turma fictícia", "2026", "Escola Fictícia", "Matutino",
                "1º ano", "Ativa");
        return new AlunoDto(id, "Aluno Fictício " + id, null, null, null, "1", null, "1", List.of(matricula));
    }

    private static PresencaDto presenca(String id, String alunoId, String dataHora, String leitorId) {
        return new PresencaDto(id, alunoId, dataHora, null, leitorId, null, null, null, null);
    }
}
