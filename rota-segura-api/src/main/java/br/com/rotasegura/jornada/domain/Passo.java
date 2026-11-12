package br.com.rotasegura.jornada.domain;

import java.time.LocalDateTime;

/**
 * Passo aceito na linha do tempo do dia, com o leitor usado (para o painel lateral da tela Jornada).
 */
public record Passo(LocalDateTime dataHora, TipoLeitor tipo, long leitorId, Long veiculoId, Long escolaId,
                    EstadoJornada estadoResultante) {
}
