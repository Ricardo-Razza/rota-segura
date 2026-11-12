package br.com.rotasegura.alunos.application;

import br.com.rotasegura.alunos.domain.Iniciais;
import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.alunos.integration.MatriculaDto;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.jornada.application.LeiturasDaApi.Vinculo;
import br.com.rotasegura.shared.integration.Conversoes;
import java.text.Collator;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;

/** Converte o cadastro da API em {@link AlunoResumo}, com a matrícula do ano e os vínculos pelas leituras. */
@Service
public class CatalogoAlunosService {

    /** Valores de {@code registrado_dispositivo} lidos como "tem biometria" / "não tem". O resto fica nulo. */
    private static final Set<String> SIM = Set.of("1", "true", "sim", "s");
    private static final Set<String> NAO = Set.of("0", "false", "nao", "não", "n");

    private static final Comparator<AlunoResumo> POR_NOME;

    static {
        Collator collator = Collator.getInstance(Locale.of("pt", "BR"));
        collator.setStrength(Collator.PRIMARY);
        POR_NOME = Comparator.comparing((AlunoResumo a) -> a.nome() == null ? "" : a.nome(), collator)
                .thenComparingLong(AlunoResumo::id);
    }

    /**
     * Alunos com matrícula no ano letivo, ordenados por nome.
     * Sem matrícula no ano o aluno fica de fora (não é esperado na escola nesse ano).
     */
    public List<AlunoResumo> doAno(Base base, int anoLetivo) {
        Map<Long, Vinculo> vinculos = base.carga().vinculosRecentes();
        List<AlunoResumo> resultado = new ArrayList<>();
        for (AlunoDto aluno : base.alunos()) {
            Long id = Conversoes.paraLong(aluno.id());
            Optional<MatriculaDto> matricula = JornadaService.matriculaDoAno(aluno, anoLetivo);
            if (id != null && matricula.isPresent()) {
                resultado.add(resumir(id, aluno, matricula.get(), vinculos.getOrDefault(id, Vinculo.NENHUM)));
            }
        }
        resultado.sort(POR_NOME);
        return resultado;
    }

    /** Um aluno, com a matrícula do ano se houver. */
    public AlunoResumo resumir(long id, AlunoDto aluno, int anoLetivo, Vinculo vinculo) {
        return resumir(id, aluno, JornadaService.matriculaDoAno(aluno, anoLetivo).orElse(null), vinculo);
    }

    private static AlunoResumo resumir(long id, AlunoDto aluno, MatriculaDto matricula, Vinculo vinculo) {
        Integer ano = matricula == null ? null : toInt(Conversoes.paraLong(matricula.escolaTurmaAnoLetivo()));
        return new AlunoResumo(id, aluno.nome(), Iniciais.de(aluno.nome()),
                matricula == null ? null : Conversoes.paraLong(matricula.escolaTurmaId()),
                matricula == null ? null : matricula.escolaTurmaDescricaoTurma(),
                matricula == null ? null : matricula.escolaTurmaTurmaDescricao(),
                matricula == null ? null : matricula.escolaTurmaTurnoDescricao(),
                ano,
                matricula == null ? null : matricula.escolaTurmaEscolaNome(),
                vinculo.escolaId(), vinculo.veiculoId(), biometria(aluno.registradoDispositivo()));
    }

    static Boolean biometria(String registradoDispositivo) {
        if (registradoDispositivo == null) {
            return null;
        }
        String valor = registradoDispositivo.trim().toLowerCase(Locale.ROOT);
        if (SIM.contains(valor)) {
            return true;
        }
        return NAO.contains(valor) ? false : null;
    }

    private static Integer toInt(Long valor) {
        return valor == null ? null : valor.intValue();
    }
}
