package br.com.rotasegura.presenca.integration;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Leitura facial em {@code /api/presenca_escolar}.
 * {@code latitude}, {@code longitude} e {@code statusNotificacaoDescricao} só vêm na busca por id.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record PresencaDto(
        String id,
        String alunoId,
        String dataHora,
        String veiculoId,
        String dispositivoFacialId,
        String caminhoImagem,
        String latitude,
        String longitude,
        String statusNotificacaoDescricao) {
}
