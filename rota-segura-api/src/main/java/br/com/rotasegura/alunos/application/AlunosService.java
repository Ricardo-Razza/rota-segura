package br.com.rotasegura.alunos.application;

import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.jornada.domain.EstadoJornada;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.shared.application.Pagina;
import java.text.Normalizer;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Lista de alunos do painel com a situação de hoje.
 * A busca por nome recebe o termo no corpo da requisição (nunca na URL: regra 1 do CLAUDE.md).
 */
@Service
public class AlunosService {

    /** Termo de busca mínimo, para não devolver a escola inteira a cada letra. */
    public static final int TERMO_MINIMO = 2;

    private final JornadaService jornadas;
    private final CatalogoAlunosService catalogo;
    private final EscopoService escopo;

    public AlunosService(JornadaService jornadas, CatalogoAlunosService catalogo, EscopoService escopo) {
        this.jornadas = jornadas;
        this.catalogo = catalogo;
        this.escopo = escopo;
    }

    public ListaDeAlunos listar(FiltroAlunos filtro, String termo, Integer pagina, Integer tamanho) {
        if (filtro.escolaId() != null) {
            escopo.exigirEscola(filtro.escolaId());
        }
        Escopo atual = escopo.atual();
        LocalDate hoje = jornadas.hoje();
        int anoLetivo = filtro.anoLetivoOu(hoje.getYear());
        Base base = jornadas.carregarBase();

        String termoNormalizado = normalizar(termo);
        List<AlunoResumo> alunos = catalogo.doAno(base, anoLetivo).stream()
                .filter(filtro::aceita)
                .filter(a -> termoNormalizado.isEmpty() || normalizar(a.nome()).contains(termoNormalizado))
                .toList();
        List<AlunoResumo> noEscopo = atual.filtrar(alunos, AlunoResumo::escolaId, AlunoResumo::veiculoId);

        Map<Long, EstadoJornada> estadoHoje = new HashMap<>();
        if (anoLetivo == hoje.getYear()) {
            for (JornadaDoDia jornada : jornadas.doDia(hoje, null, base).jornadas()) {
                estadoHoje.put(jornada.alunoId(), jornada.estado());
            }
        }
        Pagina<AlunoComSituacao> resultado = Pagina.de(noEscopo, pagina, tamanho)
                .mapear(a -> new AlunoComSituacao(a, estadoHoje.get(a.id())));
        return new ListaDeAlunos(anoLetivo, resultado, base.desatualizado(), base.incompleto());
    }

    static String normalizar(String texto) {
        if (texto == null) {
            return "";
        }
        String semAcento = Normalizer.normalize(texto.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return semAcento.toLowerCase(Locale.ROOT);
    }

    /** @param estadoHoje nulo quando a lista é de outro ano letivo */
    public record AlunoComSituacao(AlunoResumo aluno, EstadoJornada estadoHoje) {
    }

    public record ListaDeAlunos(int anoLetivo, Pagina<AlunoComSituacao> alunos, boolean desatualizado,
                                boolean incompleto) {
    }
}
