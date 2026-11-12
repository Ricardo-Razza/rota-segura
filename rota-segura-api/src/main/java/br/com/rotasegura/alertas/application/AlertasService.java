package br.com.rotasegura.alertas.application;

import br.com.rotasegura.alertas.domain.Alerta;
import br.com.rotasegura.alertas.domain.AlertaRepository;
import br.com.rotasegura.alertas.domain.EntidadeAlerta;
import br.com.rotasegura.alertas.domain.Ocorrencia;
import br.com.rotasegura.alertas.domain.StatusAlerta;
import br.com.rotasegura.alertas.domain.TipoAlerta;
import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.jornada.domain.Severidade;
import br.com.rotasegura.shared.application.CentralDeEventos;
import br.com.rotasegura.shared.application.Pagina;
import br.com.rotasegura.shared.erro.AcessoNegadoException;
import br.com.rotasegura.shared.erro.ConflitoException;
import br.com.rotasegura.shared.erro.RecursoNaoEncontradoException;
import br.com.rotasegura.shared.erro.RequisicaoInvalidaException;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Alertas: deduplicação das ocorrências, consulta com escopo e tratamento (assumir, resolver).
 * Contadores de resumo consideram só alertas ABERTO.
 */
@Service
public class AlertasService {

    public static final String EVENTO_CRIADO = "alerta.criado";
    public static final String EVENTO_ATUALIZADO = "alerta.atualizado";

    private final AlertaRepository alertas;
    private final EscopoService escopo;
    private final CentralDeEventos eventos;
    private final Clock relogio;
    private final br.com.rotasegura.shared.application.MetricasOperacao metricas;

    public AlertasService(AlertaRepository alertas, EscopoService escopo, CentralDeEventos eventos, Clock relogio,
                          br.com.rotasegura.shared.application.MetricasOperacao metricas) {
        this.alertas = alertas;
        this.escopo = escopo;
        this.eventos = eventos;
        this.relogio = relogio;
        this.metricas = metricas;
    }

    /**
     * Aplica as ocorrências de uma avaliação: cria o que é novo, atualiza o que já existe (sem duplicar)
     * e marca como cessado o que não apareceu. Publica no tempo real o que mudou.
     */
    @Transactional
    public ResultadoAvaliacao aplicar(List<Ocorrencia> encontradas) {
        Instant agora = relogio.instant();
        Map<String, Ocorrencia> porChave = new LinkedHashMap<>();
        encontradas.forEach(o -> porChave.merge(o.chave(), o, AlertasService::maisGrave));

        List<Alerta> criados = new ArrayList<>();
        List<Alerta> atualizados = new ArrayList<>();
        for (Ocorrencia o : porChave.values()) {
            Alerta existente = alertas.findByChave(o.chave()).orElse(null);
            if (existente == null) {
                criados.add(alertas.save(Alerta.abrir(o, agora)));
                metricas.alertaCriado(o.tipo().name(), o.severidade().name());
            } else if (existente.registrar(o, agora)) {
                atualizados.add(existente);
            }
        }
        for (Alerta ativo : alertas.findByAtivoTrue()) {
            if (!porChave.containsKey(ativo.getChave())) {
                ativo.cessar();
            }
        }
        criados.forEach(a -> publicar(EVENTO_CRIADO, a));
        atualizados.forEach(a -> publicar(EVENTO_ATUALIZADO, a));
        return new ResultadoAvaliacao(criados.size(), atualizados.size());
    }

    @Transactional(readOnly = true)
    public ListaDeAlertas listar(StatusAlerta status, Severidade severidade, TipoAlerta tipo, Integer pagina,
                                 Integer tamanho) {
        Escopo atual = escopo.atual();
        Set<StatusAlerta> filtroStatus = status == null ? EnumSet.allOf(StatusAlerta.class) : EnumSet.of(status);
        List<Alerta> visiveis = atual.filtrar(alertas.findByStatusInOrderByUltimaOcorrenciaEmDesc(filtroStatus),
                Alerta::getEscolaId, Alerta::getVeiculoId);
        List<AlertaResposta> filtrados = visiveis.stream()
                .filter(a -> severidade == null || a.getSeveridade() == severidade)
                .filter(a -> tipo == null || a.getTipo() == tipo)
                .map(AlertaResposta::de)
                .toList();
        return new ListaDeAlertas(resumo(atual), Pagina.de(filtrados, pagina, tamanho));
    }

    @Transactional(readOnly = true)
    public ResumoAlertas resumoAtual() {
        return resumo(escopo.atual());
    }

    @Transactional
    public AlertaResposta alterar(long id, StatusAlerta destino, String comentario) {
        Escopo atual = escopo.atual();
        Alerta alerta = alertas.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("alerta", id));
        if (atual.filtrar(List.of(alerta), Alerta::getEscolaId, Alerta::getVeiculoId).isEmpty()) {
            throw new AcessoNegadoException("Alerta fora do seu escopo.");
        }
        if (destino == null) {
            throw new RequisicaoInvalidaException("Informe o novo status.");
        }
        if (!alerta.getStatus().podeIrPara(destino)) {
            throw new ConflitoException("O alerta está " + alerta.getStatus() + " e não pode ir para " + destino + ".");
        }
        Instant agora = relogio.instant();
        if (destino == StatusAlerta.EM_ANALISE) {
            alerta.assumir(atual.usuarioId(), agora);
        } else if (destino == StatusAlerta.RESOLVIDO) {
            if (comentario == null || comentario.isBlank()) {
                throw new RequisicaoInvalidaException("Comentário obrigatório para resolver o alerta.");
            }
            alerta.resolver(atual.usuarioId(), comentario, agora);
        }
        try {
            alertas.saveAndFlush(alerta);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw new ConflitoException("O alerta foi alterado por outra pessoa. Atualize e tente de novo.");
        }
        publicar(EVENTO_ATUALIZADO, alerta);
        return AlertaResposta.de(alerta);
    }

    private ResumoAlertas resumo(Escopo atual) {
        List<Alerta> naoResolvidos = atual.filtrar(
                alertas.findByStatusInOrderByUltimaOcorrenciaEmDesc(EnumSet.of(StatusAlerta.ABERTO, StatusAlerta.EM_ANALISE)),
                Alerta::getEscolaId, Alerta::getVeiculoId);
        Map<Severidade, Long> abertos = new EnumMap<>(Severidade.class);
        for (Severidade s : Severidade.values()) {
            abertos.put(s, naoResolvidos.stream()
                    .filter(a -> a.getStatus() == StatusAlerta.ABERTO && a.getSeveridade() == s).count());
        }
        long emAnalise = naoResolvidos.stream().filter(a -> a.getStatus() == StatusAlerta.EM_ANALISE).count();
        return new ResumoAlertas(abertos, abertos.values().stream().mapToLong(Long::longValue).sum(), emAnalise);
    }

    private void publicar(String tipo, Alerta alerta) {
        eventos.publicar(tipo, AlertaResposta.de(alerta), alerta.getEscolaId(), alerta.getVeiculoId(), true);
    }

    private static Ocorrencia maisGrave(Ocorrencia a, Ocorrencia b) {
        return b.severidade().ordinal() < a.severidade().ordinal() ? b : a;
    }

    public record ResultadoAvaliacao(int criados, int atualizados) {
    }

    /**
     * @param abertosPorSeveridade só status ABERTO (em análise e resolvidos não contam como críticos)
     */
    public record ResumoAlertas(Map<Severidade, Long> abertosPorSeveridade, long abertos, long emAnalise) {

        public ResumoAlertas {
            abertosPorSeveridade = Map.copyOf(abertosPorSeveridade);
        }
    }

    public record ListaDeAlertas(ResumoAlertas resumo, Pagina<AlertaResposta> alertas) {
    }

    public record AlertaResposta(long id, TipoAlerta tipo, Severidade severidade, StatusAlerta status,
                                 EntidadeAlerta entidade, String entidadeId, String rotulo, String mensagem,
                                 int ocorrencias, boolean ativo, Instant primeiraOcorrenciaEm,
                                 Instant ultimaOcorrenciaEm, Long escolaId, Long veiculoId, Long assumidoPor,
                                 Instant assumidoEm, Long resolvidoPor, Instant resolvidoEm, String comentario) {

        static AlertaResposta de(Alerta a) {
            return new AlertaResposta(a.getId(), a.getTipo(), a.getSeveridade(), a.getStatus(), a.getEntidadeTipo(),
                    a.getEntidadeId(), a.getEntidadeRotulo(), a.getMensagem(), a.getOcorrencias(), a.isAtivo(),
                    a.getPrimeiraOcorrenciaEm(), a.getUltimaOcorrenciaEm(), a.getEscolaId(), a.getVeiculoId(),
                    a.getAssumidoPor(), a.getAssumidoEm(), a.getResolvidoPor(), a.getResolvidoEm(), a.getComentario());
        }
    }
}
