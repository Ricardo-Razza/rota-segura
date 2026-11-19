package br.com.rotasegura.veiculos.domain;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface PontoRastroSalvoRepository extends JpaRepository<PontoRastroSalvo, Long> {

    /** Trajeto de um veículo num intervalo, em ordem de hora. */
    List<PontoRastroSalvo> findByVeiculoIdAndRegistradoEmBetweenOrderByRegistradoEmAsc(long veiculoId,
                                                                                       LocalDateTime inicio,
                                                                                       LocalDateTime fim);

    /** Último ponto do veículo até a hora pedida. */
    Optional<PontoRastroSalvo> findFirstByVeiculoIdAndRegistradoEmLessThanEqualOrderByRegistradoEmDesc(
            long veiculoId, LocalDateTime ate);

    /** Primeiro ponto do veículo a partir da hora pedida. */
    Optional<PontoRastroSalvo> findFirstByVeiculoIdAndRegistradoEmGreaterThanEqualOrderByRegistradoEmAsc(
            long veiculoId, LocalDateTime desde);

    /** Apaga o que passou do prazo de retenção. */
    @Modifying
    @Transactional
    @Query("delete from PontoRastroSalvo p where p.registradoEm < :limite")
    int apagarAntesDe(@Param("limite") LocalDateTime limite);
}
