package br.com.rotasegura.auth.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegistroAuditoriaRepository extends JpaRepository<RegistroAuditoria, Long> {

    List<RegistroAuditoria> findByAcaoOrderByOcorridoEmDesc(AcaoAuditoria acao);
}
