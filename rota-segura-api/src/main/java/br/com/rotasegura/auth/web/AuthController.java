package br.com.rotasegura.auth.web;

import br.com.rotasegura.auth.application.AuthProperties;
import br.com.rotasegura.auth.application.AuthService;
import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.application.Sessao;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Autenticação do painel: login, renovação, saída e dados do usuário atual. */
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    static final String COOKIE_REFRESH = "rs_refresh";
    static final String CAMINHO_COOKIE = "/api/v1/auth";

    private final AuthService auth;
    private final EscopoService escopo;
    private final AuthProperties props;

    public AuthController(AuthService auth, EscopoService escopo, AuthProperties props) {
        this.auth = auth;
        this.escopo = escopo;
        this.props = props;
    }

    @PostMapping("/login")
    ResponseEntity<TokenResponse> login(@Valid @RequestBody LoginRequest pedido, HttpServletRequest request) {
        return responder(auth.login(pedido.login(), pedido.senha(), request.getRemoteAddr()));
    }

    @PostMapping("/refresh")
    ResponseEntity<TokenResponse> refresh(@CookieValue(name = COOKIE_REFRESH, required = false) String refresh) {
        return responder(auth.renovar(refresh));
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(@CookieValue(name = COOKIE_REFRESH, required = false) String refresh) {
        auth.sair(refresh);
        return ResponseEntity.noContent()
                .header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString())
                .build();
    }

    @GetMapping("/me")
    UsuarioResponse eu() {
        return UsuarioResponse.de(auth.usuario(escopo.atual().usuarioId()));
    }

    private ResponseEntity<TokenResponse> responder(Sessao sessao) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie(sessao.refreshToken(), props.refreshTtl()).toString())
                .body(new TokenResponse(sessao.accessToken(), sessao.expiraEmSegundos(),
                        UsuarioResponse.de(sessao.usuario())));
    }

    private ResponseCookie cookie(String valor, Duration validade) {
        return ResponseCookie.from(COOKIE_REFRESH, valor)
                .httpOnly(true)
                .secure(props.cookieSecure())
                .sameSite("Strict")
                .path(CAMINHO_COOKIE)
                .maxAge(validade)
                .build();
    }
}
