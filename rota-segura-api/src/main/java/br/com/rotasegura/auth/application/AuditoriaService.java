package br.com.rotasegura.auth.application;

import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.auth.domain.RegistroAuditoria;
import br.com.rotasegura.auth.domain.RegistroAuditoriaRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/** Grava a trilha de auditoria. Só ids: nunca nome, CPF ou contato. */
@Service
public class AuditoriaService {

    private final RegistroAuditoriaRepository registros;
    private final EscopoService escopo;
    private final Clock clock;

    public AuditoriaService(RegistroAuditoriaRepository registros, EscopoService escopo, Clock clock) {
        this.registros = registros;
        this.escopo = escopo;
        this.clock = clock;
    }

    /** Registra uma ação do usuário autenticado sobre uma entidade (ex.: "aluno", 42). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrar(AcaoAuditoria acao, String entidade, Object entidadeId) {
        gravar(escopo.atual().usuarioId(), acao, entidade, entidadeId);
    }

    /** Registra uma ação quando ainda não há usuário autenticado (login, refresh). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrarPara(Long usuarioId, AcaoAuditoria acao) {
        gravar(usuarioId, acao, null, null);
    }

    private void gravar(Long usuarioId, AcaoAuditoria acao, String entidade, Object entidadeId) {
        registros.save(new RegistroAuditoria(usuarioId, acao, entidade,
                entidadeId == null ? null : String.valueOf(entidadeId), ipDaRequisicao(), clock.instant()));
    }

    private static String ipDaRequisicao() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes atributos) {
            HttpServletRequest request = atributos.getRequest();
            return request.getRemoteAddr();
        }
        return null;
    }
}
