package br.com.rotasegura.analises.application;

import br.com.rotasegura.alunos.application.AlunoResumo;
import br.com.rotasegura.alunos.application.FiltroAlunos;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.function.Function;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.format.annotation.DateTimeFormat.ISO;

/**
 * Filtros da tela de Análises. Campo nulo não filtra.
 *
 * @param dataInicio início do período (padrão: 29 dias antes do fim)
 * @param dataFim    fim do período (padrão: hoje)
 * @param comparar   com que período comparar (padrão: o período anterior de mesmo tamanho)
 * @param escolaIds  uma ou mais escolas; vazio = todas do escopo
 * @param etapa      etapa configurada em {@code rota-segura.dashboard.etapas}
 * @param veiculoId  só vale para a aba de frota
 */
public record FiltroAnalise(@DateTimeFormat(iso = ISO.DATE) LocalDate dataInicio,
                            @DateTimeFormat(iso = ISO.DATE) LocalDate dataFim, Comparacao comparar, List<Long> escolaIds,
                            String etapa, String anoEscolar, Long turmaId, String turno, Long veiculoId,
                            Integer anoLetivo) {

    public FiltroAnalise {
        escolaIds = escolaIds == null ? List.of() : escolaIds.stream().filter(id -> id != null).distinct().toList();
        comparar = comparar == null ? Comparacao.PERIODO_ANTERIOR : comparar;
    }

    /** Filtro de alunos comum (turma, ano escolar, turno); escolas e etapa são checadas à parte. */
    FiltroAlunos alunos() {
        return new FiltroAlunos(anoLetivo, null, anoEscolar, turmaId, turno);
    }

    boolean aceita(AlunoResumo aluno, Function<String, Optional<String>> etapaDe) {
        if (!alunos().aceita(aluno)) {
            return false;
        }
        if (!escolaIds.isEmpty() && (aluno.escolaId() == null || !escolaIds.contains(aluno.escolaId()))) {
            return false;
        }
        if (etapa == null || etapa.isBlank()) {
            return true;
        }
        return etapaDe.apply(aluno.anoEscolar())
                .map(e -> e.toLowerCase(Locale.ROOT).equals(etapa.trim().toLowerCase(Locale.ROOT)))
                .orElse(false);
    }

    boolean aceitaEscola(Long escolaId) {
        return escolaIds.isEmpty() || (escolaId != null && escolaIds.contains(escolaId));
    }

    boolean aceitaVeiculo(Long id) {
        return veiculoId == null || veiculoId.equals(id);
    }
}
