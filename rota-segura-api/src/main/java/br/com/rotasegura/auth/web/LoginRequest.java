package br.com.rotasegura.auth.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank @Size(max = 120) String login,
        @NotBlank @Size(max = 200) String senha) {

    /** Nunca expõe a senha, nem por acidente em log. */
    @Override
    public String toString() {
        return "LoginRequest[***]";
    }
}
