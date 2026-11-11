package br.com.rotasegura.auth.application;

import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.auth.domain.MascaraContato;
import br.com.rotasegura.shared.erro.AcessoNegadoException;
import org.springframework.stereotype.Service;

/** Contato de responsável: mascarado por padrão; revelar exige permissão e sempre gera auditoria. */
@Service
public class ContatoService {

    private final EscopoService escopo;
    private final AuditoriaService auditoria;

    public ContatoService(EscopoService escopo, AuditoriaService auditoria) {
        this.escopo = escopo;
        this.auditoria = auditoria;
    }

    public String mascarado(String contato) {
        return MascaraContato.mascarar(contato);
    }

    /**
     * Devolve o contato sem máscara e registra quem pediu.
     *
     * @param responsavelId id do responsável dono do contato (é o que vai para a auditoria)
     * @throws AcessoNegadoException se o perfil não pode revelar contatos
     */
    public String revelar(long responsavelId, String contato) {
        if (!escopo.atual().perfil().podeRevelarContato()) {
            throw new AcessoNegadoException("Seu perfil não pode ver contatos de responsáveis.");
        }
        auditoria.registrar(AcaoAuditoria.REVELACAO_CONTATO, "responsavel", responsavelId);
        return contato;
    }
}
