package br.com.rotasegura.alunos.application;

import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadaService.Base;
import br.com.rotasegura.responsaveis.application.VinculosResponsaveisService;
import br.com.rotasegura.responsaveis.application.VinculosResponsaveisService.Indice;
import br.com.rotasegura.shared.application.Pagina;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Pendências de cadastro dos alunos do ano letivo.
 * "Sem veículo" não é avaliado: o cadastro da API não informa o veículo do aluno.
 */
@Service
public class PendenciasCadastroService {

    private final JornadaService jornadas;
    private final CatalogoAlunosService catalogo;
    private final VinculosResponsaveisService responsaveis;
    private final EscopoService escopo;

    public PendenciasCadastroService(JornadaService jornadas, CatalogoAlunosService catalogo,
                                     VinculosResponsaveisService responsaveis, EscopoService escopo) {
        this.jornadas = jornadas;
        this.catalogo = catalogo;
        this.responsaveis = responsaveis;
        this.escopo = escopo;
    }

    public Pendencias listar(FiltroAlunos filtro, TipoPendencia tipo, Integer pagina, Integer tamanho) {
        if (filtro.escolaId() != null) {
            escopo.exigirEscola(filtro.escolaId());
        }
        Escopo atual = escopo.atual();
        Base base = jornadas.carregarBase();
        int anoLetivo = filtro.anoLetivoOu(jornadas.hoje().getYear());
        Indice indice = responsaveis.atual();

        List<AlunoResumo> alunos = atual.filtrar(
                catalogo.doAno(base, anoLetivo).stream().filter(filtro::aceita).toList(),
                AlunoResumo::escolaId, AlunoResumo::veiculoId);

        List<AlunoComPendencias> comPendencia = new ArrayList<>();
        Map<TipoPendencia, Long> porTipo = new EnumMap<>(TipoPendencia.class);
        for (TipoPendencia t : TipoPendencia.values()) {
            porTipo.put(t, 0L);
        }
        for (AlunoResumo aluno : alunos) {
            Set<TipoPendencia> pendencias = EnumSet.noneOf(TipoPendencia.class);
            if (Boolean.FALSE.equals(aluno.biometria())) {
                pendencias.add(TipoPendencia.SEM_BIOMETRIA);
            }
            if (indice.confiavel() && indice.doAluno(aluno.id()).isEmpty()) {
                pendencias.add(TipoPendencia.SEM_RESPONSAVEL);
            }
            pendencias.forEach(p -> porTipo.merge(p, 1L, Long::sum));
            if (!pendencias.isEmpty() && (tipo == null || pendencias.contains(tipo))) {
                comPendencia.add(new AlunoComPendencias(aluno, pendencias));
            }
        }
        return new Pendencias(anoLetivo, porTipo, Pagina.de(comPendencia, pagina, tamanho), indice.confiavel(),
                base.desatualizado(), base.incompleto());
    }

    public enum TipoPendencia {
        /** {@code registrado_dispositivo} indica que o rosto não está cadastrado no leitor. */
        SEM_BIOMETRIA,
        /** Nenhum responsável vinculado (só avaliado com o índice de responsáveis completo). */
        SEM_RESPONSAVEL
    }

    public record AlunoComPendencias(AlunoResumo aluno, Set<TipoPendencia> pendencias) {

        public AlunoComPendencias {
            pendencias = Set.copyOf(pendencias);
        }
    }

    /**
     * @param responsaveisAvaliados falso enquanto o índice de responsáveis não estiver pronto e completo:
     *                              nesse caso {@code SEM_RESPONSAVEL} não é apontado
     */
    public record Pendencias(int anoLetivo, Map<TipoPendencia, Long> porTipo, Pagina<AlunoComPendencias> alunos,
                             boolean responsaveisAvaliados, boolean desatualizado, boolean incompleto) {

        public Pendencias {
            porTipo = Map.copyOf(porTipo);
        }
    }
}
