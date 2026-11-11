package br.com.rotasegura.auth.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UsuarioRepository extends JpaRepository<Usuario, Long> {

    Optional<Usuario> findByLoginIgnoreCase(String login);

    boolean existsByLoginIgnoreCase(String login);
}
