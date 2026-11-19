package br.com.rotasegura.alertas.domain;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertaRepository extends JpaRepository<Alerta, Long> {

    Optional<Alerta> findByChave(String chave);

    List<Alerta> findByStatusInOrderByUltimaOcorrenciaEmDesc(Collection<StatusAlerta> status);

    List<Alerta> findByAtivoTrue();

    /** Alertas abertos pela primeira vez no intervalo (análises do período). */
    List<Alerta> findByPrimeiraOcorrenciaEmBetween(Instant inicio, Instant fim);
}
