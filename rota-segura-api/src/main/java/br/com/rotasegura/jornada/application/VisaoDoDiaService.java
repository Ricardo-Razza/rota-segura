package br.com.rotasegura.jornada.application;

import br.com.rotasegura.alunos.application.AlunoResumo;
import br.com.rotasegura.alunos.application.CatalogoAlunosService;
import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.jornada.application.LeiturasDaApi.Vinculo;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.shared.integration.Conversoes;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Cruza alunos e jornadas de um dia e aplica filtros globais e escopo do usuário.
 * Escola e veículo de cada aluno: os do dia (pelas leituras); sem leitura no dia, os mais recentes conhecidos.
 */
@Service
public class VisaoDoDiaService {

    private final JornadaService jornadas;
    private final CatalogoAlunosService catalogo;

    public VisaoDoDiaService(JornadaService jornadas, CatalogoAlunosService catalogo) {
        this.jornadas = jornadas;
        this.catalogo = catalogo;
    }

    public VisaoDoDia montar(LocalDate data, FiltroAlunos filtro, Escopo escopo, Base base) {
        int anoLetivo = filtro.anoLetivoOu(data.getYear());
        ResumoJornadas resumo = jornadas.doDia(data, null, base);

        Map<Long, AlunoResumo> matriculados = new HashMap<>();
        catalogo.doAno(base, anoLetivo).forEach(a -> matriculados.put(a.id(), a));
        Map<Long, AlunoDto> cadastro = new HashMap<>();
        base.alunos().forEach(a -> {
            Long id = Conversoes.paraLong(a.id());
            if (id != null) {
                cadastro.put(id, a);
            }
        });
        Map<Long, Vinculo> vinculos = base.carga().vinculosRecentes();

        List<Linha> linhas = new ArrayList<>();
        for (JornadaDoDia jornada : resumo.jornadas()) {
            AlunoResumo aluno = matriculados.get(jornada.alunoId());
            boolean esperado = aluno != null;
            if (aluno == null) {
                // Leitura de aluno sem matrícula no ano: entra na visão, mas não conta como esperado.
                AlunoDto dto = cadastro.get(jornada.alunoId());
                Vinculo vinculo = vinculos.getOrDefault(jornada.alunoId(), Vinculo.NENHUM);
                aluno = dto != null
                        ? catalogo.resumir(jornada.alunoId(), dto, anoLetivo, vinculo)
                        : new AlunoResumo(jornada.alunoId(), null, "?", null, null, null, null, null, null,
                                vinculo.escolaId(), vinculo.veiculoId(), null);
            }
            AlunoResumo doDia = comVinculoDoDia(aluno, jornada);
            if (filtro.aceita(doDia)) {
                linhas.add(new Linha(doDia, jornada, esperado));
            }
        }
        List<Linha> noEscopo = escopo.filtrar(linhas, l -> l.aluno().escolaId(), l -> l.aluno().veiculoId());
        return new VisaoDoDia(data, resumo, noEscopo);
    }

    private static AlunoResumo comVinculoDoDia(AlunoResumo a, JornadaDoDia jornada) {
        Long escola = jornada.escolaId() != null ? jornada.escolaId() : a.escolaId();
        Long veiculo = jornada.veiculoId() != null ? jornada.veiculoId() : a.veiculoId();
        return new AlunoResumo(a.id(), a.nome(), a.iniciais(), a.turmaId(), a.turma(), a.anoEscolar(), a.turno(),
                a.anoLetivo(), a.escolaNome(), escola, veiculo, a.biometria());
    }

    /**
     * @param esperado o aluno tem matrícula no ano letivo (entra no denominador da frequência)
     */
    public record Linha(AlunoResumo aluno, JornadaDoDia jornada, boolean esperado) {
    }

    public record VisaoDoDia(LocalDate data, ResumoJornadas resumo, List<Linha> linhas) {

        public VisaoDoDia {
            linhas = List.copyOf(linhas);
        }
    }
}
