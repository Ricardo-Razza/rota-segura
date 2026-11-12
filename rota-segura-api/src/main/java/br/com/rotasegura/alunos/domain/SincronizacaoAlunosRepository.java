package br.com.rotasegura.alunos.domain;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SincronizacaoAlunosRepository extends JpaRepository<SincronizacaoAlunos, Long> {

    Optional<SincronizacaoAlunos> findFirstByOrderByIniciadoEmDesc();
}
