package br.com.rotasegura.alunos.application;

import br.com.rotasegura.alunos.domain.SincronizacaoAlunos;
import br.com.rotasegura.alunos.domain.SincronizacaoAlunosRepository;
import br.com.rotasegura.alunos.integration.AlunosClient;
import br.com.rotasegura.auth.application.AuditoriaService;
import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.shared.erro.ConflitoException;
import java.time.Clock;
import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Dispara {@code GET /api/alunos/sincronizar} na API externa (a única "ação" desta fase, e ainda assim um GET),
 * registra quem disparou e o resultado. Só uma sincronização por vez nesta instância.
 */
@Service
public class SincronizacaoAlunosService {

    private static final Logger LOG = LoggerFactory.getLogger(SincronizacaoAlunosService.class);

    private final AlunosClient alunos;
    private final SincronizacaoAlunosRepository execucoes;
    private final EscopoService escopo;
    private final AuditoriaService auditoria;
    private final Clock relogio;
    private final AtomicBoolean emAndamento = new AtomicBoolean(false);

    public SincronizacaoAlunosService(AlunosClient alunos, SincronizacaoAlunosRepository execucoes,
                                      EscopoService escopo, AuditoriaService auditoria, Clock relogio) {
        this.alunos = alunos;
        this.execucoes = execucoes;
        this.escopo = escopo;
        this.auditoria = auditoria;
        this.relogio = relogio;
    }

    public ResultadoSincronizacao sincronizar() {
        Long usuarioId = escopo.atual().usuarioId();
        if (!emAndamento.compareAndSet(false, true)) {
            throw new ConflitoException("Já existe uma sincronização de alunos em andamento.");
        }
        try {
            SincronizacaoAlunos execucao = execucoes.save(new SincronizacaoAlunos(usuarioId, relogio.instant()));
            auditoria.registrar(AcaoAuditoria.SINCRONIZACAO_ALUNOS, "sincronizacao", execucao.getId());
            try {
                int status = alunos.sincronizar();
                execucao.concluirComSucesso(status, relogio.instant());
            } catch (RuntimeException e) {
                execucao.concluirComFalha(e.getClass().getSimpleName(), relogio.instant());
                LOG.warn("Sincronização de alunos falhou. execucao={} motivo={}", execucao.getId(),
                        e.getClass().getSimpleName());
            }
            return ResultadoSincronizacao.de(execucoes.save(execucao));
        } finally {
            emAndamento.set(false);
        }
    }

    public Optional<ResultadoSincronizacao> ultima() {
        return execucoes.findFirstByOrderByIniciadoEmDesc().map(ResultadoSincronizacao::de);
    }

    public record ResultadoSincronizacao(long id, long usuarioId, Instant iniciadoEm, Instant concluidoEm,
                                         boolean sucesso, Integer httpStatus, String erroTipo) {

        static ResultadoSincronizacao de(SincronizacaoAlunos s) {
            return new ResultadoSincronizacao(s.getId(), s.getUsuarioId(), s.getIniciadoEm(), s.getConcluidoEm(),
                    Boolean.TRUE.equals(s.getSucesso()), s.getHttpStatus(), s.getErroTipo());
        }
    }
}
