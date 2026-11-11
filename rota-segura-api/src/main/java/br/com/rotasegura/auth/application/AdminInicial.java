package br.com.rotasegura.auth.application;

import br.com.rotasegura.auth.domain.Perfil;
import br.com.rotasegura.auth.domain.Usuario;
import br.com.rotasegura.auth.domain.UsuarioRepository;
import java.time.Clock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Cria o administrador inicial a partir de variáveis de ambiente, se ainda não existir.
 * Sem as variáveis, não faz nada: nenhuma credencial padrão existe no código.
 */
@Component
public class AdminInicial implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminInicial.class);

    private final UsuarioRepository usuarios;
    private final PasswordEncoder encoder;
    private final AuthProperties props;
    private final Clock clock;

    public AdminInicial(UsuarioRepository usuarios, PasswordEncoder encoder, AuthProperties props, Clock clock) {
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.props = props;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!StringUtils.hasText(props.adminLogin()) || !StringUtils.hasText(props.adminSenha())) {
            return;
        }
        if (usuarios.existsByLoginIgnoreCase(props.adminLogin())) {
            return;
        }
        Usuario admin = usuarios.save(new Usuario(props.adminLogin().trim(), encoder.encode(props.adminSenha()),
                "Administrador", Perfil.ADMIN, clock.instant()));
        log.info("Administrador inicial criado. usuarioId={}", admin.getId());
    }
}
