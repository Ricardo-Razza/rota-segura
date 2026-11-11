package br.com.rotasegura.auth.application;

import br.com.rotasegura.auth.domain.Usuario;
import java.time.Clock;
import java.time.Instant;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

/** Emite o JWT de acesso (curta duração). O token leva só id, perfil e escopo, nunca nome ou login. */
@Service
public class TokenService {

    public static final String CLAIM_PERFIL = "perfil";
    public static final String CLAIM_ESCOLAS = "escolas";
    public static final String CLAIM_VEICULOS = "veiculos";
    static final String EMISSOR = "rota-segura";

    private final JwtEncoder encoder;
    private final AuthProperties props;
    private final Clock clock;

    public TokenService(JwtEncoder encoder, AuthProperties props, Clock clock) {
        this.encoder = encoder;
        this.props = props;
        this.clock = clock;
    }

    public String emitir(Usuario usuario) {
        Instant agora = clock.instant();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(EMISSOR)
                .subject(String.valueOf(usuario.getId()))
                .issuedAt(agora)
                .expiresAt(agora.plus(props.accessTtl()))
                .claim(CLAIM_PERFIL, usuario.getPerfil().name())
                .claim(CLAIM_ESCOLAS, usuario.getEscolas().stream().sorted().toList())
                .claim(CLAIM_VEICULOS, usuario.getVeiculos().stream().sorted().toList())
                .build();
        JwsHeader cabecalho = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(cabecalho, claims)).getTokenValue();
    }

    public long validadeEmSegundos() {
        return props.accessTtl().toSeconds();
    }
}
