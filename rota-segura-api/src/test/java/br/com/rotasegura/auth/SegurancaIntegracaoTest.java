package br.com.rotasegura.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rotasegura.BancoDeTeste;
import br.com.rotasegura.auth.application.ContatoService;
import br.com.rotasegura.auth.application.LimitadorDeLogin;
import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.auth.domain.Perfil;
import br.com.rotasegura.auth.domain.RegistroAuditoria;
import br.com.rotasegura.auth.domain.RegistroAuditoriaRepository;
import br.com.rotasegura.auth.domain.Usuario;
import br.com.rotasegura.auth.domain.UsuarioRepository;
import br.com.rotasegura.shared.erro.AcessoNegadoException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** Fluxo completo de autenticação contra MySQL real (Testcontainers). Usuários e senhas fictícios. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(BancoDeTeste.class)
class SegurancaIntegracaoTest {

    private static final String SENHA = "senha-ficticia-de-teste";
    private static final String COOKIE = "rs_refresh";

    @Autowired
    MockMvc mvc;
    @Autowired
    ObjectMapper json;
    @Autowired
    UsuarioRepository usuarios;
    @Autowired
    RegistroAuditoriaRepository auditoria;
    @Autowired
    PasswordEncoder encoder;
    @Autowired
    LimitadorDeLogin limitador;
    @Autowired
    JwtDecoder jwtDecoder;
    @Autowired
    ContatoService contatos;
    @Autowired
    JdbcTemplate jdbc;

    @BeforeEach
    void preparar() {
        limitador.limparTudo();
        criarSeFaltar("diretor.teste", Perfil.DIRETOR, Set.of(1L, 2L), Set.of(), true);
        criarSeFaltar("monitor.teste", Perfil.MONITOR, Set.of(), Set.of(7L), true);
        criarSeFaltar("inativo.teste", Perfil.GESTAO, Set.of(), Set.of(), false);
    }

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void loginDevolveTokenDe15MinutosECookieDeRefreshProtegido() throws Exception {
        MvcResult resultado = mvc.perform(pedidoDeLogin("admin.teste", SENHA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.expiraEmSegundos").value(900))
                .andExpect(jsonPath("$.usuario.perfil").value("ADMIN"))
                .andExpect(header().string("Cache-Control", "no-store"))
                .andReturn();

        String setCookie = resultado.getResponse().getHeader("Set-Cookie");
        assertThat(setCookie).contains("rs_refresh=", "HttpOnly", "Secure", "SameSite=Strict",
                "Path=/api/v1/auth");
        String refresh = resultado.getResponse().getCookie(COOKIE).getValue();
        assertThat(resultado.getResponse().getContentAsString()).doesNotContain(refresh);

        Jwt jwt = jwtDecoder.decode(corpo(resultado).get("accessToken").asText());
        assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofMinutes(15));
        assertThat(jwt.getClaims()).doesNotContainKeys("nome", "login");
    }

    @Test
    void adminInicialVemDasVariaveisDeAmbienteEExisteUmaVezSo() {
        assertThat(usuarios.findAll()).filteredOn(u -> u.getLogin().equals("admin.teste"))
                .singleElement()
                .satisfies(admin -> assertThat(admin.getPerfil()).isEqualTo(Perfil.ADMIN));
    }

    @Test
    void senhaErradaLoginInexistenteEUsuarioInativoRecebemAMesmaResposta() throws Exception {
        for (String[] caso : new String[][] {
                {"admin.teste", "senha-errada"}, {"ninguem.teste", SENHA}, {"inativo.teste", SENHA}}) {
            mvc.perform(pedidoDeLogin(caso[0], caso[1]))
                    .andExpect(status().isUnauthorized())
                    .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                    .andExpect(jsonPath("$.detail").value("Login ou senha inválidos."))
                    .andExpect(header().doesNotExist("Set-Cookie"));
        }
    }

    @Test
    void loginSemCamposObrigatoriosDevolve400() throws Exception {
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"login\":\"\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void rotaProtegidaSemTokenOuComTokenInvalidoDevolve401EmProblemDetail() throws Exception {
        mvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Não autenticado"));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer token.invalido.aqui"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/qualquer-coisa"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void cadaPerfilRecebeSoOSeuEscopo() throws Exception {
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + tokenDe("diretor.teste")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfil").value("DIRETOR"))
                .andExpect(jsonPath("$.escolas.length()").value(2))
                .andExpect(jsonPath("$.escolas[0]").value(1))
                .andExpect(jsonPath("$.veiculos").isEmpty())
                .andExpect(jsonPath("$.podeVerIndicadoresSensiveis").value(false));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer " + tokenDe("monitor.teste")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.perfil").value("MONITOR"))
                .andExpect(jsonPath("$.escolas").isEmpty())
                .andExpect(jsonPath("$.veiculos[0]").value(7))
                .andExpect(jsonPath("$.podeRevelarContato").value(false));
    }

    @Test
    void refreshRotacionaEReusoDoTokenAntigoDerrubaAFamilia() throws Exception {
        String primeiro = refreshDe(mvc.perform(pedidoDeLogin("admin.teste", SENHA)).andReturn());

        MvcResult renovado = mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie(COOKIE, primeiro)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn();
        String segundo = refreshDe(renovado);
        assertThat(segundo).isNotEqualTo(primeiro);

        // O token antigo reaparece: resposta 401 e a família inteira é revogada.
        mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie(COOKIE, primeiro)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.title").value("Sessão expirada"));
        mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie(COOKIE, segundo)))
                .andExpect(status().isUnauthorized());
        assertThat(auditoria.findByAcaoOrderByOcorridoEmDesc(AcaoAuditoria.REFRESH_REUTILIZADO)).isNotEmpty();
    }

    @Test
    void refreshAusenteDesconhecidoOuExpiradoDevolve401() throws Exception {
        mvc.perform(post("/api/v1/auth/refresh")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie(COOKIE, "token-que-nao-existe")))
                .andExpect(status().isUnauthorized());

        String refresh = refreshDe(mvc.perform(pedidoDeLogin("diretor.teste", SENHA)).andReturn());
        jdbc.update("update refresh_token set expira_em = utc_timestamp(6) - interval 1 minute where usado_em is null");
        mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie(COOKIE, refresh)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevogaASessaoEApagaOCookie() throws Exception {
        String refresh = refreshDe(mvc.perform(pedidoDeLogin("monitor.teste", SENHA)).andReturn());

        MvcResult saida = mvc.perform(post("/api/v1/auth/logout").cookie(new Cookie(COOKIE, refresh)))
                .andExpect(status().isNoContent())
                .andReturn();
        assertThat(saida.getResponse().getHeader("Set-Cookie")).contains("rs_refresh=;", "Max-Age=0");

        mvc.perform(post("/api/v1/auth/refresh").cookie(new Cookie(COOKIE, refresh)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void rateLimitBloqueiaDepoisDeCincoFalhasMesmoComSenhaCerta() throws Exception {
        for (int i = 0; i < 5; i++) {
            mvc.perform(pedidoDeLogin("diretor.teste", "senha-errada")).andExpect(status().isUnauthorized());
        }
        mvc.perform(pedidoDeLogin("diretor.teste", SENHA))
                .andExpect(status().isTooManyRequests())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Muitas tentativas"));
        // O bloqueio é por IP + login: outro usuário continua entrando.
        mvc.perform(pedidoDeLogin("admin.teste", SENHA)).andExpect(status().isOk());
    }

    @Test
    void respostasLevamCabecalhosDeSeguranca() throws Exception {
        mvc.perform(pedidoDeLogin("admin.teste", SENHA))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string("X-Frame-Options", "DENY"))
                .andExpect(header().string("Referrer-Policy", "no-referrer"))
                .andExpect(header().exists("Content-Security-Policy"))
                .andExpect(header().exists("Permissions-Policy"));
    }

    @Test
    void corsAceitaSoAOrigemConfigurada() throws Exception {
        mvc.perform(options("/api/v1/auth/login")
                        .header("Origin", "http://localhost:4200")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4200"))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
        mvc.perform(options("/api/v1/auth/login")
                        .header("Origin", "http://origem-nao-autorizada.exemplo")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void loginFicaNaAuditoriaComUsuarioIpEHoraSemDadoPessoal() throws Exception {
        Instant antes = Instant.now().minusSeconds(1);
        mvc.perform(pedidoDeLogin("admin.teste", SENHA)).andExpect(status().isOk());

        RegistroAuditoria registro = auditoria.findByAcaoOrderByOcorridoEmDesc(AcaoAuditoria.LOGIN).get(0);
        assertThat(registro.getUsuarioId()).isEqualTo(usuarios.findByLoginIgnoreCase("admin.teste").orElseThrow().getId());
        assertThat(registro.getIp()).isEqualTo("127.0.0.1");
        assertThat(registro.getOcorridoEm()).isAfter(antes);
        assertThat(registro.getEntidade()).isNull();
    }

    @Test
    void revelarContatoExigePermissaoEGeraAuditoria() throws Exception {
        String contato = "ficticio@exemplo.com";
        assertThat(contatos.mascarado(contato)).isEqualTo("f*******@exemplo.com");

        autenticarComo("monitor.teste");
        long antes = auditoria.count();
        assertThatThrownBy(() -> contatos.revelar(55, contato)).isInstanceOf(AcessoNegadoException.class);
        assertThat(auditoria.count()).isEqualTo(antes);

        autenticarComo("diretor.teste");
        assertThat(contatos.revelar(55, contato)).isEqualTo(contato);

        List<RegistroAuditoria> revelacoes = auditoria.findByAcaoOrderByOcorridoEmDesc(AcaoAuditoria.REVELACAO_CONTATO);
        assertThat(revelacoes).hasSize(1);
        assertThat(revelacoes.get(0).getEntidade()).isEqualTo("responsavel");
        assertThat(revelacoes.get(0).getEntidadeId()).isEqualTo("55");
        assertThat(revelacoes.get(0).getUsuarioId())
                .isEqualTo(usuarios.findByLoginIgnoreCase("diretor.teste").orElseThrow().getId());
    }

    private void criarSeFaltar(String login, Perfil perfil, Set<Long> escolas, Set<Long> veiculos, boolean ativo) {
        if (usuarios.existsByLoginIgnoreCase(login)) {
            return;
        }
        Usuario usuario = new Usuario(login, encoder.encode(SENHA), "Usuario Ficticio", perfil, Instant.now())
                .comEscolas(escolas)
                .comVeiculos(veiculos);
        if (!ativo) {
            usuario.desativar();
        }
        usuarios.save(usuario);
    }

    private org.springframework.test.web.servlet.RequestBuilder pedidoDeLogin(String login, String senha) {
        return post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"login\":\"%s\",\"senha\":\"%s\"}".formatted(login, senha));
    }

    private String tokenDe(String login) throws Exception {
        return corpo(mvc.perform(pedidoDeLogin(login, SENHA)).andExpect(status().isOk()).andReturn())
                .get("accessToken").asText();
    }

    private void autenticarComo(String login) throws Exception {
        Jwt jwt = jwtDecoder.decode(tokenDe(login));
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }

    private JsonNode corpo(MvcResult resultado) throws Exception {
        return json.readTree(resultado.getResponse().getContentAsString());
    }

    private static String refreshDe(MvcResult resultado) {
        return resultado.getResponse().getCookie(COOKIE).getValue();
    }
}
