package br.com.rotasegura.alertas.application;

import br.com.rotasegura.shared.erro.RequisicaoInvalidaException;
import java.time.Duration;
import java.time.LocalTime;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração da avaliação de alertas e do tempo real.
 *
 * @param avaliacaoHabilitada liga o ciclo de 30 s (desligado nos testes)
 * @param intervalo           intervalo entre avaliações
 * @param horariosDeRota      janelas "HH:mm-HH:mm" em que leitor sem leitura vira alerta
 */
@ConfigurationProperties("rota-segura.alertas")
public record AlertasProperties(Boolean avaliacaoHabilitada, Duration intervalo, List<String> horariosDeRota) {

    public AlertasProperties {
        avaliacaoHabilitada = avaliacaoHabilitada == null || avaliacaoHabilitada;
        intervalo = intervalo == null ? Duration.ofSeconds(30) : intervalo;
        horariosDeRota = horariosDeRota == null ? List.of() : List.copyOf(horariosDeRota);
        janelas(horariosDeRota);
    }

    public List<Janela> janelas() {
        return janelas(horariosDeRota);
    }

    private static List<Janela> janelas(List<String> textos) {
        return textos.stream().map(t -> {
            String[] partes = t.split("-");
            if (partes.length != 2) {
                throw new RequisicaoInvalidaException("Horário de rota inválido: " + t + " (use HH:mm-HH:mm)");
            }
            return new Janela(LocalTime.parse(partes[0].trim()), LocalTime.parse(partes[1].trim()));
        }).toList();
    }

    /** Janela de rota; {@code inicio} antes de {@code fim}, no mesmo dia. */
    public record Janela(LocalTime inicio, LocalTime fim) {

        public boolean contem(LocalTime hora) {
            return !hora.isBefore(inicio) && !hora.isAfter(fim);
        }
    }
}
