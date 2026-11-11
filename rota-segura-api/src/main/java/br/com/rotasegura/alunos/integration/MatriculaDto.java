package br.com.rotasegura.alunos.integration;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

/** Matrícula do aluno, como vem em {@code matriculas[]} de {@code /api/alunos/{id}}. */
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record MatriculaDto(
        String escolaTurmaId,
        String escolaTurmaDescricaoTurma,
        String escolaTurmaAnoLetivo,
        String escolaTurmaEscolaNome,
        String escolaTurmaTurnoDescricao,
        String escolaTurmaTurmaDescricao,
        String escolaTurmaSituacaoTurmaDescricao) {
}
