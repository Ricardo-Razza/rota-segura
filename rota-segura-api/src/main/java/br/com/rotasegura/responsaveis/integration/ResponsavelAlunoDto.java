package br.com.rotasegura.responsaveis.integration;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/**
 * Aluno vinculado a um responsável, como vem em {@code details[]} de {@code /api/responsaveis/{id}}.
 * Contém dado pessoal de menor: o {@code toString} mostra só o id.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record ResponsavelAlunoDto(
        String id,
        String nome,
        String cpf,
        String dataNascimento,
        String enderecoInformadoId,
        String tipoStatusId,
        String imagem,
        String registradoDispositivo,
        String criadoEm,
        String alteradoEm,
        String criadoPor,
        String alteradoPor,
        String tipoNotificacaoId,
        String escolaridadeId,
        String certidaoNascimento,
        String identificadorPlataformaExterna,
        String matricula) {

    @Override
    public String toString() {
        return "ResponsavelAlunoDto[id=" + id + "]";
    }
}
