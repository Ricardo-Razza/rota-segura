package br.com.rotasegura.dispositivos.integration;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/** Item de {@code /api/dispositivos_faciais}. Todos os campos chegam como texto e podem vir vazios. */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record DispositivoFacialDto(
        String id,
        String descricao,
        String veiculoId,
        String mac,
        String veiculoPrefixo,
        String veiculoIdentificadorRastreador,
        String tipoDeUsoDispositivoId,
        String tipoDeUsoDispositivoDescricao,
        String escolaLatitude,
        String escolaLongitude,
        String escolaId) {
}
