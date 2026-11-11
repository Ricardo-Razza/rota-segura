package br.com.rotasegura.shared.integration;

import java.util.List;

/** Envelope de paginação da API externa. */
public record PaginaApi<T>(List<T> data, Meta meta) {

    public PaginaApi {
        data = data == null ? List.of() : List.copyOf(data);
    }
}
