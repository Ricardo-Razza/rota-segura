package br.com.rotasegura.responsaveis.integration;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.util.List;

/**
 * Responsável em {@code /api/responsaveis}. {@code details} (alunos vinculados) só vem na busca por id.
 * Contém dado pessoal: o {@code toString} mostra só o id.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record ResponsavelDto(
        String id,
        String nome,
        String criadoEm,
        String excluidoEm,
        String chatwootContactId,
        String chatwootConversationId,
        List<ResponsavelAlunoDto> details) {

    public ResponsavelDto {
        details = details == null ? List.of() : List.copyOf(details);
    }

    @Override
    public String toString() {
        return "ResponsavelDto[id=" + id + "]";
    }
}
