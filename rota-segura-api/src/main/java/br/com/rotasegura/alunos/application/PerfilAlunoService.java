package br.com.rotasegura.alunos.application;

import br.com.rotasegura.alunos.integration.AlunoDto;
import br.com.rotasegura.alunos.integration.AlunosClient;
import br.com.rotasegura.auth.application.AuditoriaService;
import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.jornada.application.JornadaService;
import br.com.rotasegura.jornada.application.JornadasPainelService;
import br.com.rotasegura.jornada.application.LeiturasDaApi;
import br.com.rotasegura.jornada.application.LeiturasDaApi.Vinculo;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.responsaveis.application.VinculosResponsaveisService;
import br.com.rotasegura.responsaveis.application.VinculosResponsaveisService.Indice;
import br.com.rotasegura.shared.integration.ResultadoCache;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Perfil do aluno. Todo acesso passa pelo escopo e fica na auditoria (quem, quando, id do aluno, IP).
 * Não devolve CPF, data de nascimento, endereço nem a imagem.
 */
@Service
public class PerfilAlunoService {

    private final AlunosClient alunos;
    private final CatalogoAlunosService catalogo;
    private final JornadaService jornadas;
    private final JornadasPainelService painel;
    private final LeiturasDaApi leiturasDaApi;
    private final VinculosResponsaveisService responsaveis;
    private final AuditoriaService auditoria;

    public PerfilAlunoService(AlunosClient alunos, CatalogoAlunosService catalogo, JornadaService jornadas,
                              JornadasPainelService painel, LeiturasDaApi leiturasDaApi,
                              VinculosResponsaveisService responsaveis, AuditoriaService auditoria) {
        this.alunos = alunos;
        this.catalogo = catalogo;
        this.jornadas = jornadas;
        this.painel = painel;
        this.leiturasDaApi = leiturasDaApi;
        this.responsaveis = responsaveis;
        this.auditoria = auditoria;
    }

    public PerfilAluno perfil(long alunoId) {
        painel.exigirAlunoNoEscopo(alunoId);
        ResultadoCache<AlunoDto> cadastro = alunos.buscarPorId(alunoId);
        auditoria.registrar(AcaoAuditoria.ACESSO_PERFIL_ALUNO, "aluno", alunoId);

        LocalDate hoje = jornadas.hoje();
        Vinculo vinculo = leiturasDaApi.carregar().vinculosRecentes().getOrDefault(alunoId, Vinculo.NENHUM);
        AlunoResumo resumo = catalogo.resumir(alunoId, cadastro.valor(), hoje.getYear(), vinculo);
        JornadaDoDia jornadaHoje = jornadas.doAluno(alunoId, hoje);

        Indice indice = responsaveis.atual();
        List<ResponsavelDoAluno> doAluno = indice.doAluno(alunoId).stream()
                .map(r -> new ResponsavelDoAluno(r.id(), r.nome(), null, false))
                .toList();
        return new PerfilAluno(resumo, jornadaHoje, doAluno,
                new SituacaoResponsaveis(indice.pronto(), indice.completo()),
                cadastro.desatualizado());
    }

    /**
     * Responsável no perfil. A API de responsáveis não traz telefone nem e-mail; quando houver fonte,
     * {@code contatoMascarado} vem preenchido e a revelação passa por {@code ContatoService} (auditada).
     */
    public record ResponsavelDoAluno(long id, String nome, String contatoMascarado, boolean contatoDisponivel) {
    }

    /**
     * @param pronto   o índice aluno → responsáveis já foi montado
     * @param completo todos os responsáveis foram consultados; se falso, a lista pode estar faltando alguém
     */
    public record SituacaoResponsaveis(boolean pronto, boolean completo) {
    }

    public record PerfilAluno(AlunoResumo aluno, JornadaDoDia jornadaHoje, List<ResponsavelDoAluno> responsaveis,
                              SituacaoResponsaveis situacaoResponsaveis, boolean desatualizado) {

        public PerfilAluno {
            responsaveis = List.copyOf(responsaveis);
        }
    }
}
