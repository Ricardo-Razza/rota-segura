package br.com.rotasegura.alertas.domain;

import br.com.rotasegura.jornada.domain.Severidade;
import java.util.Objects;

/**
 * Uma condição de alerta encontrada por uma regra numa avaliação.
 *
 * @param rotulo   como a entidade aparece na etiqueta (placa, "#id"); é o mesmo texto usado na mensagem
 * @param janela   período em que a ocorrência é a mesma (ex.: o dia "2026-03-10")
 * @param mensagem texto gerado a partir dos dados, sem nome de aluno
 */
public record Ocorrencia(TipoAlerta tipo, Severidade severidade, EntidadeAlerta entidade, String entidadeId,
                         String rotulo, String janela, String mensagem, Long escolaId, Long veiculoId) {

    public Ocorrencia {
        Objects.requireNonNull(tipo, "tipo");
        Objects.requireNonNull(severidade, "severidade");
        Objects.requireNonNull(entidade, "entidade");
        Objects.requireNonNull(entidadeId, "entidadeId");
        Objects.requireNonNull(janela, "janela");
        Objects.requireNonNull(mensagem, "mensagem");
    }

    /** Chave de deduplicação: tipo + entidade + janela. */
    public String chave() {
        return tipo + ":" + entidade + ":" + entidadeId + ":" + janela;
    }
}
