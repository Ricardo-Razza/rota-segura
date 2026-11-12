package br.com.rotasegura.relatorios.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.DayOfWeek;
import java.time.Instant;

/** Relatório semanal enviado por e-mail ao próprio usuário que o agendou. */
@Entity
@Table(name = "relatorio_agendado")
public class RelatorioAgendado {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false)
    private Long usuarioId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoRelatorio tipo;

    @Column(name = "escola_id")
    private Long escolaId;

    @Column(name = "dia_semana", nullable = false)
    private int diaSemana;

    @Column(nullable = false)
    private boolean ativo = true;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm;

    @Column(name = "ultimo_envio_em")
    private Instant ultimoEnvioEm;

    protected RelatorioAgendado() {
    }

    public RelatorioAgendado(Long usuarioId, TipoRelatorio tipo, Long escolaId, DayOfWeek dia, Instant criadoEm) {
        this.usuarioId = usuarioId;
        this.tipo = tipo;
        this.escolaId = escolaId;
        this.diaSemana = dia.getValue();
        this.criadoEm = criadoEm;
    }

    public void registrarEnvio(Instant em) {
        this.ultimoEnvioEm = em;
    }

    public void desativar() {
        this.ativo = false;
    }

    public Long getId() {
        return id;
    }

    public Long getUsuarioId() {
        return usuarioId;
    }

    public TipoRelatorio getTipo() {
        return tipo;
    }

    public Long getEscolaId() {
        return escolaId;
    }

    public DayOfWeek getDiaSemana() {
        return DayOfWeek.of(diaSemana);
    }

    public boolean isAtivo() {
        return ativo;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Instant getUltimoEnvioEm() {
        return ultimoEnvioEm;
    }
}
