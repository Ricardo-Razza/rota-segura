package br.com.rotasegura.veiculos.domain;

import java.time.LocalDateTime;

/**
 * Posição GPS de um veículo.
 *
 * @param velocidadeKmh nula quando o rastreador não informa
 * @param rumo          graus a partir do norte; nulo quando não informado
 * @param emMovimento   nulo quando o rastreador não informa
 * @param registradaEm  hora do GPS, no fuso das escolas
 */
public record PosicaoVeiculo(double latitude, double longitude, Double velocidadeKmh, Double rumo,
                             Boolean emMovimento, LocalDateTime registradaEm) {

    public double distanciaAte(double outraLatitude, double outraLongitude) {
        return Geo.distanciaMetros(latitude, longitude, outraLatitude, outraLongitude);
    }

    /** Mesmo registro do rastreador (mesma hora e mesmo lugar). */
    public boolean mesmaLeituraQue(PosicaoVeiculo outra) {
        return outra != null && registradaEm.equals(outra.registradaEm)
                && latitude == outra.latitude && longitude == outra.longitude;
    }
}
