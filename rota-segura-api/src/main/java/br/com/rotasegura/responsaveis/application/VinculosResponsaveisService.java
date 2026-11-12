package br.com.rotasegura.responsaveis.application;

import br.com.rotasegura.responsaveis.integration.ResponsaveisClient;
import br.com.rotasegura.responsaveis.integration.ResponsavelAlunoDto;
import br.com.rotasegura.responsaveis.integration.ResponsavelDto;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.Conversoes;
import br.com.rotasegura.shared.integration.ResultadoCache;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

/**
 * Índice aluno → responsáveis. A API só informa os alunos de um responsável na busca por id
 * ({@code details[]}), então o índice é montado em segundo plano, com teto de buscas por rodada,
 * e as telas leem sempre a última versão pronta.
 */
@Service
public class VinculosResponsaveisService {

    private static final Logger LOG = LoggerFactory.getLogger(VinculosResponsaveisService.class);

    private final ResponsaveisClient responsaveis;
    private final Propriedades propriedades;
    private final Clock relogio;
    private volatile Indice indice = Indice.VAZIO;

    public VinculosResponsaveisService(ResponsaveisClient responsaveis, Propriedades propriedades, Clock relogio) {
        this.responsaveis = responsaveis;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    /** Última versão pronta do índice (vazia e não pronta até a primeira montagem terminar). */
    public Indice atual() {
        return indice;
    }

    @Scheduled(initialDelayString = "PT5S", fixedDelayString = "${rota-segura.responsaveis.intervalo-indice:10m}")
    void atualizarAgendado() {
        if (propriedades.indiceHabilitado()) {
            atualizar();
        }
    }

    /** Remonta o índice. Em falha, mantém a versão anterior. */
    public void atualizar() {
        try {
            indice = montar();
        } catch (RuntimeException e) {
            // Só o tipo do erro: a mensagem pode carregar dado pessoal.
            LOG.warn("Falha ao montar o índice de responsáveis; mantendo a versão anterior. motivo={}",
                    e.getClass().getSimpleName());
        }
    }

    private Indice montar() {
        ResultadoCache<ColecaoPaginada<ResponsavelDto>> lista = responsaveis.listarTodos();
        Map<Long, List<ResponsavelResumo>> porAluno = new HashMap<>();
        int buscas = 0;
        boolean completo = !lista.valor().truncada();
        for (ResponsavelDto item : lista.valor().itens()) {
            Long responsavelId = Conversoes.paraLong(item.id());
            if (responsavelId == null || (item.excluidoEm() != null && !item.excluidoEm().isBlank())) {
                continue;
            }
            if (buscas >= propriedades.maxBuscasIndice()) {
                completo = false;
                break;
            }
            buscas++;
            ResponsavelDto detalhado = responsaveis.buscarPorId(responsavelId).valor();
            ResponsavelResumo resumo = new ResponsavelResumo(responsavelId, detalhado.nome());
            for (ResponsavelAlunoDto aluno : detalhado.details()) {
                Long alunoId = Conversoes.paraLong(aluno.id());
                if (alunoId != null) {
                    porAluno.computeIfAbsent(alunoId, id -> new ArrayList<>()).add(resumo);
                }
            }
        }
        LOG.info("Índice de responsáveis montado: responsaveis={} alunos={} completo={}",
                buscas, porAluno.size(), completo);
        return new Indice(porAluno, relogio.instant(), true, completo);
    }

    /** Responsável como o painel mostra. Contato não vem da API de responsáveis. */
    public record ResponsavelResumo(long id, String nome) {

        @Override
        public String toString() {
            return "ResponsavelResumo[id=" + id + "]";
        }
    }

    /**
     * @param pronto   a primeira montagem já terminou
     * @param completo todos os responsáveis foram consultados (sem truncar pela paginação ou pelo teto)
     */
    public record Indice(Map<Long, List<ResponsavelResumo>> porAluno, Instant montadoEm, boolean pronto,
                         boolean completo) {

        static final Indice VAZIO = new Indice(Map.of(), null, false, false);

        public Indice {
            Map<Long, List<ResponsavelResumo>> copia = new HashMap<>();
            porAluno.forEach((aluno, lista) -> copia.put(aluno, List.copyOf(lista)));
            porAluno = Map.copyOf(copia);
        }

        public List<ResponsavelResumo> doAluno(long alunoId) {
            return porAluno.getOrDefault(alunoId, List.of());
        }

        /** Só dá para afirmar "sem responsável" com o índice pronto e completo. */
        public boolean confiavel() {
            return pronto && completo;
        }
    }

    @ConfigurationProperties("rota-segura.responsaveis")
    public record Propriedades(boolean indiceHabilitado, Duration intervaloIndice, int maxBuscasIndice) {
    }
}
