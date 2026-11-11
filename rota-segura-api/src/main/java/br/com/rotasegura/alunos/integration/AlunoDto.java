package br.com.rotasegura.alunos.integration;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.util.List;

/**
 * Aluno em {@code /api/alunos}. {@code matriculas} só vem na busca por id.
 * Contém dado pessoal de menor: o {@code toString} mostra só o id para nada vazar em log.
 */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record AlunoDto(
        String id,
        String nome,
        String cpf,
        String dataNascimento,
        String enderecoInformadoId,
        String tipoStatusId,
        String imagem,
        String registradoDispositivo,
        List<MatriculaDto> matriculas) {

    public AlunoDto {
        matriculas = matriculas == null ? List.of() : List.copyOf(matriculas);
    }

    @Override
    public String toString() {
        return "AlunoDto[id=" + id + "]";
    }
}
