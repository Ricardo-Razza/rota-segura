package br.com.rotasegura.alunos.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Uma execução da sincronização de alunos. Guarda só ids, horários e o resultado técnico. */
@Entity
@Table(name = "sincronizacao_alunos")
public class SincronizacaoAlunos {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Column(name = "iniciado_em", nullable = false)
    private Instant iniciadoEm;

    @Column(name = "concluido_em")
    private Instant concluidoEm;

    private Boolean sucesso;

    @Column(name = "http_status")
    private Integer httpStatus;

    @Column(name = "erro_tipo")
    private String erroTipo;

    protected SincronizacaoAlunos() {
    }

    public SincronizacaoAlunos(Long usuarioId, Instant iniciadoEm) {
        this.usuarioId = usuarioId;
        this.iniciadoEm = iniciadoEm;
    }

    public void concluirComSucesso(int status, Instant em) {
        this.sucesso = true;
        this.httpStatus = status;
        this.concluidoEm = em;
    }

    /** @param erroTipo só o nome da classe do erro: a mensagem pode carregar dado pessoal */
    public void concluirComFalha(String erroTipo, Instant em) {
        this.sucesso = false;
        this.erroTipo = erroTipo;
        this.concluidoEm = em;
    }

    public Long getId() {
        return id;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public Instant getIniciadoEm() {
        return iniciadoEm;
    }

    public Instant getConcluidoEm() {
        return concluidoEm;
    }

    public Boolean getSucesso() {
        return sucesso;
    }

    public Integer getHttpStatus() {
        return httpStatus;
    }

    public String getErroTipo() {
        return erroTipo;
    }
}
