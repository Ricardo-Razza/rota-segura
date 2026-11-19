package br.com.rotasegura.veiculos.domain;

import br.com.rotasegura.veiculos.domain.RastroDoDia.PontoRastro;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Optional;

/**
 * Onde o ônibus estava numa hora (ex.: no embarque de um aluno), a partir do trajeto guardado.
 * <p>
 * O trajeto só ganha ponto quando o ônibus anda; parado no embarque, o último ponto é o local da parada.
 * Mas um último ponto antigo também pode ser rastreador sem sinal, então ele só vale se for recente ou se
 * o ponto seguinte (quando o ônibus voltou a andar) estiver perto dele. Sem isso, não há local: melhor
 * "indisponível" que um ponto errado.
 */
public final class PontoNoMomento {

    /** Último ponto até esse tempo antes da hora vale sem confirmação. */
    static final Duration RECENTE = Duration.ofMinutes(2);
    /** Parada mais longa que isso não é considerada. */
    static final Duration PARADA_MAXIMA = Duration.ofMinutes(20);
    /** Saída da parada a até essa distância confirma que o ônibus estava parado ali. */
    static final double RAIO_PARADA_M = 100;

    private PontoNoMomento() {
    }

    /**
     * @param antes  último ponto do veículo até a hora (ou nulo)
     * @param depois primeiro ponto do veículo depois da hora (ou nulo)
     */
    public static Optional<PontoRastro> escolher(LocalDateTime hora, PontoRastro antes, PontoRastro depois) {
        if (antes != null) {
            Duration desde = Duration.between(antes.em(), hora);
            if (!desde.isNegative() && desde.compareTo(RECENTE) <= 0) {
                return Optional.of(antes);
            }
            if (!desde.isNegative() && desde.compareTo(PARADA_MAXIMA) <= 0 && depois != null
                    && Duration.between(hora, depois.em()).compareTo(PARADA_MAXIMA) <= 0
                    && Geo.distanciaMetros(antes.latitude(), antes.longitude(), depois.latitude(),
                    depois.longitude()) <= RAIO_PARADA_M) {
                return Optional.of(antes);
            }
        }
        if (depois != null) {
            Duration ate = Duration.between(hora, depois.em());
            if (!ate.isNegative() && ate.compareTo(RECENTE) <= 0) {
                return Optional.of(depois);
            }
        }
        return Optional.empty();
    }
}
