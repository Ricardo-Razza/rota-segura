package br.com.rotasegura.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Refresh token rotativo. O valor em si nunca é guardado, só o hash. */
@Entity
@Table(name = "refresh_token")
public class RefreshToken {

    @Id
    private UUID id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(name = "token_hash", nullable = false)
    private String tokenHash;

    @Column(nullable = false)
    private UUID familia;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm;

    @Column(name = "expira_em", nullable = false)
    private Instant expiraEm;

    @Column(name = "usado_em")
    private Instant usadoEm;

    @Column(name = "revogado_em")
    private Instant revogadoEm;

    protected RefreshToken() {
    }

    public RefreshToken(Long usuarioId, String tokenHash, UUID familia, Instant criadoEm, Instant expiraEm) {
        this.id = UUID.randomUUID();
        this.usuarioId = usuarioId;
        this.tokenHash = tokenHash;
        this.familia = familia;
        this.criadoEm = criadoEm;
        this.expiraEm = expiraEm;
    }

    /** Já foi trocado por outro ou revogado: apresentá-lo de novo indica roubo ou repetição. */
    public boolean jaConsumido() {
        return usadoEm != null || revogadoEm != null;
    }

    public boolean expirado(Instant agora) {
        return !agora.isBefore(expiraEm);
    }

    public void marcarUsado(Instant agora) {
        this.usadoEm = agora;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public UUID getFamilia() {
        return familia;
    }
}
