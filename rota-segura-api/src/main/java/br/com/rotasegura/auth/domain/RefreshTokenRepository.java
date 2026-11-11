package br.com.rotasegura.auth.domain;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** Revoga toda a cadeia de rotações de um login. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update RefreshToken t set t.revogadoEm = :agora where t.familia = :familia and t.revogadoEm is null")
    int revogarFamilia(@Param("familia") UUID familia, @Param("agora") Instant agora);
}
