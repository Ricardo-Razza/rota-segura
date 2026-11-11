package br.com.rotasegura.auth.application;

import br.com.rotasegura.auth.application.AuthExceptions.CredenciaisInvalidasException;
import br.com.rotasegura.auth.application.AuthExceptions.RefreshInvalidoException;
import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.auth.domain.RefreshToken;
import br.com.rotasegura.auth.domain.RefreshTokenRepository;
import br.com.rotasegura.auth.domain.Usuario;
import br.com.rotasegura.auth.domain.UsuarioRepository;
import br.com.rotasegura.shared.erro.AcessoNegadoException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Login, renovação e encerramento de sessão do painel. */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UsuarioRepository usuarios;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder encoder;
    private final TokenService tokens;
    private final LimitadorDeLogin limitador;
    private final AuditoriaService auditoria;
    private final AuthProperties props;
    private final Clock clock;
    private final SecureRandom aleatorio = new SecureRandom();
    /** Hash usado quando o login não existe, para o tempo de resposta não revelar isso. */
    private final String hashFalso;

    public AuthService(UsuarioRepository usuarios, RefreshTokenRepository refreshTokens, PasswordEncoder encoder,
                       TokenService tokens, LimitadorDeLogin limitador, AuditoriaService auditoria,
                       AuthProperties props, Clock clock) {
        this.usuarios = usuarios;
        this.refreshTokens = refreshTokens;
        this.encoder = encoder;
        this.tokens = tokens;
        this.limitador = limitador;
        this.auditoria = auditoria;
        this.props = props;
        this.clock = clock;
        this.hashFalso = encoder.encode(UUID.randomUUID().toString());
    }

    @Transactional(noRollbackFor = CredenciaisInvalidasException.class)
    public Sessao login(String login, String senha, String ip) {
        String chave = ip + "|" + login.trim().toLowerCase(Locale.ROOT);
        limitador.verificar(chave);

        Optional<Usuario> encontrado = usuarios.findByLoginIgnoreCase(login.trim());
        boolean senhaConfere = encoder.matches(senha, encontrado.map(Usuario::getSenhaHash).orElse(hashFalso));
        if (encontrado.isEmpty() || !senhaConfere || !encontrado.get().isAtivo()) {
            limitador.registrarFalha(chave);
            auditoria.registrarPara(encontrado.map(Usuario::getId).orElse(null), AcaoAuditoria.LOGIN_FALHA);
            throw new CredenciaisInvalidasException();
        }

        Usuario usuario = encontrado.get();
        limitador.registrarSucesso(chave);
        auditoria.registrarPara(usuario.getId(), AcaoAuditoria.LOGIN);
        return novaSessao(usuario, UUID.randomUUID());
    }

    /**
     * Troca o refresh token por um novo (rotação). Um token já usado ou revogado que reaparece
     * derruba a família inteira: é sinal de cópia.
     */
    @Transactional(noRollbackFor = RefreshInvalidoException.class)
    public Sessao renovar(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            throw new RefreshInvalidoException();
        }
        Instant agora = clock.instant();
        RefreshToken atual = refreshTokens.findByTokenHash(hash(refreshToken))
                .orElseThrow(RefreshInvalidoException::new);

        if (atual.jaConsumido()) {
            refreshTokens.revogarFamilia(atual.getFamilia(), agora);
            auditoria.registrarPara(atual.getUsuarioId(), AcaoAuditoria.REFRESH_REUTILIZADO);
            log.warn("Refresh token reutilizado; família revogada. usuarioId={}", atual.getUsuarioId());
            throw new RefreshInvalidoException();
        }
        if (atual.expirado(agora)) {
            throw new RefreshInvalidoException();
        }
        Usuario usuario = usuarios.findById(atual.getUsuarioId())
                .filter(Usuario::isAtivo)
                .orElseThrow(RefreshInvalidoException::new);

        atual.marcarUsado(agora);
        return novaSessao(usuario, atual.getFamilia());
    }

    /** Encerra a sessão: revoga a família do refresh token apresentado. Token desconhecido é ignorado. */
    @Transactional
    public void sair(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) {
            return;
        }
        refreshTokens.findByTokenHash(hash(refreshToken))
                .ifPresent(token -> refreshTokens.revogarFamilia(token.getFamilia(), clock.instant()));
    }

    @Transactional(readOnly = true)
    public Usuario usuario(Long id) {
        return usuarios.findById(id)
                .filter(Usuario::isAtivo)
                .orElseThrow(() -> new AcessoNegadoException("Usuário inativo ou inexistente."));
    }

    private Sessao novaSessao(Usuario usuario, UUID familia) {
        byte[] bytes = new byte[32];
        aleatorio.nextBytes(bytes);
        String refresh = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant agora = clock.instant();
        refreshTokens.save(new RefreshToken(usuario.getId(), hash(refresh), familia, agora,
                agora.plus(props.refreshTtl())));
        return new Sessao(tokens.emitir(usuario), tokens.validadeEmSegundos(), refresh, usuario);
    }

    static String hash(String valor) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha.digest(valor.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
