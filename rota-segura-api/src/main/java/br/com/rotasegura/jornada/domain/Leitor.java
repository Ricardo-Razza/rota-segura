package br.com.rotasegura.jornada.domain;

import java.util.Objects;

/**
 * Leitor facial já classificado.
 *
 * @param veiculoId veículo onde o leitor está instalado (pode faltar)
 * @param escolaId  escola ligada ao leitor (pode faltar)
 */
public record Leitor(long id, TipoLeitor tipo, Long veiculoId, Long escolaId) {

    public Leitor {
        Objects.requireNonNull(tipo, "tipo");
    }
}
