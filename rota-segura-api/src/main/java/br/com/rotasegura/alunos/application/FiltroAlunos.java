package br.com.rotasegura.alunos.application;

import java.util.Locale;
import java.util.Objects;

/**
 * Filtros globais do painel aplicados a alunos. Campo nulo não filtra.
 * Texto (ano escolar, turno) compara sem diferenciar maiúsculas.
 */
public record FiltroAlunos(Integer anoLetivo, Long escolaId, String anoEscolar, Long turmaId, String turno) {

    public static final FiltroAlunos NENHUM = new FiltroAlunos(null, null, null, null, null);

    public boolean aceita(AlunoResumo aluno) {
        return (escolaId == null || escolaId.equals(aluno.escolaId()))
                && (turmaId == null || turmaId.equals(aluno.turmaId()))
                && textoIgual(anoEscolar, aluno.anoEscolar())
                && textoIgual(turno, aluno.turno());
    }

    /** Ano letivo efetivo: o informado ou o ano da data de referência. */
    public int anoLetivoOu(int padrao) {
        return anoLetivo != null ? anoLetivo : padrao;
    }

    private static boolean textoIgual(String filtro, String valor) {
        if (filtro == null || filtro.isBlank()) {
            return true;
        }
        return valor != null && Objects.equals(normalizar(filtro), normalizar(valor));
    }

    private static String normalizar(String texto) {
        return texto.trim().toLowerCase(Locale.ROOT);
    }
}
