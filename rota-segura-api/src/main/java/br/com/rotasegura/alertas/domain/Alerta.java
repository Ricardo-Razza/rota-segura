package br.com.rotasegura.alertas.domain;

import br.com.rotasegura.jornada.domain.Severidade;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;

/**
 * Alerta deduplicado: um por chave (tipo + entidade + janela). Reaparecer a mesma condição soma uma
 * ocorrência no alerta existente em vez de criar outro.
 */
@Entity
@Table(name = "alerta")
public class Alerta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String chave;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TipoAlerta tipo;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Severidade severidade;

    @Enumerated(EnumType.STRING)
    @Column(name = "entidade_tipo", nullable = false)
    private EntidadeAlerta entidadeTipo;

    @Column(name = "entidade_id", nullable = false)
    private String entidadeId;

    @Column(name = "entidade_rotulo")
    private String entidadeRotulo;

    @Column(nullable = false)
    private String janela;

    @Column(nullable = false)
    private String mensagem;

    @Column(name = "escola_id")
    private Long escolaId;

    @Column(name = "veiculo_id")
    private Long veiculoId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private StatusAlerta status;

    /** A condição estava presente na última avaliação. */
    @Column(nullable = false)
    private boolean ativo;

    @Column(nullable = false)
    private int ocorrencias;

    @Column(name = "primeira_ocorrencia_em", nullable = false)
    private Instant primeiraOcorrenciaEm;

    @Column(name = "ultima_ocorrencia_em", nullable = false)
    private Instant ultimaOcorrenciaEm;

    @Column(name = "assumido_por")
    private Long assumidoPor;

    @Column(name = "assumido_em")
    private Instant assumidoEm;

    @Column(name = "resolvido_por")
    private Long resolvidoPor;

    @Column(name = "resolvido_em")
    private Instant resolvidoEm;

    private String comentario;

    @Version
    private long versao;

    protected Alerta() {
    }

    public static Alerta abrir(Ocorrencia o, Instant em) {
        Alerta a = new Alerta();
        a.chave = o.chave();
        a.tipo = o.tipo();
        a.entidadeTipo = o.entidade();
        a.entidadeId = o.entidadeId();
        a.janela = o.janela();
        a.status = StatusAlerta.ABERTO;
        a.ativo = true;
        a.ocorrencias = 1;
        a.primeiraOcorrenciaEm = em;
        a.ultimaOcorrenciaEm = em;
        a.copiarDados(o);
        return a;
    }

    /**
     * Aplica a ocorrência vista nesta avaliação.
     *
     * @return verdadeiro se algo visível mudou (nova ocorrência, severidade ou mensagem)
     */
    public boolean registrar(Ocorrencia o, Instant em) {
        if (status == StatusAlerta.RESOLVIDO) {
            // Resolvido vale para a janela inteira: a mesma condição não reabre o alerta.
            return false;
        }
        boolean mudou = false;
        if (!ativo) {
            ativo = true;
            ocorrencias++;
            ultimaOcorrenciaEm = em;
            mudou = true;
        }
        if (severidade != o.severidade() || !mensagem.equals(o.mensagem())) {
            mudou = true;
        }
        copiarDados(o);
        return mudou;
    }

    /** A condição não apareceu nesta avaliação. */
    public void cessar() {
        ativo = false;
    }

    public void assumir(Long usuarioId, Instant em) {
        exigirTransicao(StatusAlerta.EM_ANALISE);
        status = StatusAlerta.EM_ANALISE;
        assumidoPor = usuarioId;
        assumidoEm = em;
    }

    public void resolver(Long usuarioId, String comentario, Instant em) {
        exigirTransicao(StatusAlerta.RESOLVIDO);
        if (comentario == null || comentario.isBlank()) {
            throw new IllegalArgumentException("Comentário obrigatório para resolver o alerta.");
        }
        status = StatusAlerta.RESOLVIDO;
        resolvidoPor = usuarioId;
        resolvidoEm = em;
        this.comentario = comentario.trim();
    }

    private void exigirTransicao(StatusAlerta destino) {
        if (!status.podeIrPara(destino)) {
            throw new IllegalStateException("Transição inválida: " + status + " → " + destino);
        }
    }

    private void copiarDados(Ocorrencia o) {
        severidade = o.severidade();
        entidadeRotulo = o.rotulo();
        mensagem = o.mensagem();
        escolaId = o.escolaId();
        veiculoId = o.veiculoId();
    }

    public Long getId() {
        return id;
    }

    public String getChave() {
        return chave;
    }

    public TipoAlerta getTipo() {
        return tipo;
    }

    public Severidade getSeveridade() {
        return severidade;
    }

    public EntidadeAlerta getEntidadeTipo() {
        return entidadeTipo;
    }

    public String getEntidadeId() {
        return entidadeId;
    }

    public String getEntidadeRotulo() {
        return entidadeRotulo;
    }

    public String getJanela() {
        return janela;
    }

    public String getMensagem() {
        return mensagem;
    }

    public Long getEscolaId() {
        return escolaId;
    }

    public Long getVeiculoId() {
        return veiculoId;
    }

    public StatusAlerta getStatus() {
        return status;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public int getOcorrencias() {
        return ocorrencias;
    }

    public Instant getPrimeiraOcorrenciaEm() {
        return primeiraOcorrenciaEm;
    }

    public Instant getUltimaOcorrenciaEm() {
        return ultimaOcorrenciaEm;
    }

    public Long getAssumidoPor() {
        return assumidoPor;
    }

    public Instant getAssumidoEm() {
        return assumidoEm;
    }

    public Long getResolvidoPor() {
        return resolvidoPor;
    }

    public Instant getResolvidoEm() {
        return resolvidoEm;
    }

    public String getComentario() {
        return comentario;
    }

    @Override
    public String toString() {
        return "Alerta[id=" + id + ", chave=" + chave + "]";
    }
}
