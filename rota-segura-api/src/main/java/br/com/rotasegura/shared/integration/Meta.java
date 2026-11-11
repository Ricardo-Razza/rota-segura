package br.com.rotasegura.shared.integration;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Metadados de paginação da API externa. A API às vezes devolve os números como texto
 * (ex.: {@code "current_page": "2"}); o Jackson converte os dois formatos.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record Meta(Integer total, Integer perPage, Integer currentPage, Integer lastPage) {
}
