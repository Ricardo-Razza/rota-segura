package br.com.rotasegura.auth.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Linha da trilha de auditoria: quem, quando, o quê (tipo + id) e de qual IP. Sem dado pessoal. */
@Entity
@Table(name = "auditoria")
public class RegistroAuditoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id")
    private Long usuarioId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AcaoAuditoria acao;

    private String entidade;

    @Column(name = "entidade_id")
    private String entidadeId;

    private String ip;

    @Column(name = "ocorrido_em", nullable = false)
    private Instant ocorridoEm;

    protected RegistroAuditoria() {
    }

    public RegistroAuditoria(Long usuarioId, AcaoAuditoria acao, String entidade, String entidadeId, String ip,
                             Instant ocorridoEm) {
        this.usuarioId = usuarioId;
        this.acao = acao;
        this.entidade = entidade;
        this.entidadeId = entidadeId;
        this.ip = ip;
        this.ocorridoEm = ocorridoEm;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public AcaoAuditoria getAcao() {
        return acao;
    }

    public String getEntidade() {
        return entidade;
    }

    public String getEntidadeId() {
        return entidadeId;
    }

    public String getIp() {
        return ip;
    }

    public Instant getOcorridoEm() {
        return ocorridoEm;
    }
}
