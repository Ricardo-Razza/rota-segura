package br.com.rotasegura.alunos.web;

import br.com.rotasegura.alunos.application.AlunosService;
import br.com.rotasegura.alunos.application.FiltroAlunos;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Busca por nome: o termo vai no corpo, nunca na URL (LGPD, regra 1). */
public record BuscaAlunosRequest(
        @NotBlank @Size(min = AlunosService.TERMO_MINIMO, max = 100) String termo,
        Integer anoLetivo, Long escolaId, String anoEscolar, Long turmaId, String turno,
        Integer pagina, Integer tamanho) {

    FiltroAlunos filtro() {
        return new FiltroAlunos(anoLetivo, escolaId, anoEscolar, turmaId, turno);
    }

    @Override
    public String toString() {
        return "BuscaAlunosRequest[escolaId=" + escolaId + ", turmaId=" + turmaId + "]";
    }
}
