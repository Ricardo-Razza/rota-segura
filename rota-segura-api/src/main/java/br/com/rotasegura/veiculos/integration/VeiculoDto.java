package br.com.rotasegura.veiculos.integration;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/** Item de {@code /api/veiculos}. */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record VeiculoDto(
        String id,
        String placa,
        String marca,
        String modelo,
        String identificadorRastreador,
        String imagem,
        String cor,
        String prefixo) {
}
