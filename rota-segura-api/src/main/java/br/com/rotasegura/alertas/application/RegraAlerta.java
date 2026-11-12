package br.com.rotasegura.alertas.application;

import br.com.rotasegura.alertas.domain.Ocorrencia;
import java.util.List;

/**
 * Regra de alerta plugável: todo bean que implementa esta interface entra no ciclo de avaliação.
 * A regra só lê o contexto e devolve as condições encontradas; deduplicar e persistir é do {@link AlertasService}.
 */
public interface RegraAlerta {

    List<Ocorrencia> avaliar(ContextoAvaliacao contexto);
}
