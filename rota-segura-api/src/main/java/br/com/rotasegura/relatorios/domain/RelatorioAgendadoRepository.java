package br.com.rotasegura.relatorios.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RelatorioAgendadoRepository extends JpaRepository<RelatorioAgendado, Long> {

    List<RelatorioAgendado> findByUsuarioIdAndAtivoTrueOrderByIdAsc(Long usuarioId);

    List<RelatorioAgendado> findByAtivoTrueAndDiaSemana(int diaSemana);
}
