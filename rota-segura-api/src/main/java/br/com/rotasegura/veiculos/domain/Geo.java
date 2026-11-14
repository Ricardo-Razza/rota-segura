package br.com.rotasegura.veiculos.domain;

/** Cálculos geográficos simples (esfera de raio médio da Terra; erro desprezível nas distâncias de uma rota). */
public final class Geo {

    static final double RAIO_TERRA_M = 6_371_008.8;
    /** 1 nó = 1,852 km/h (o Traccar informa a velocidade em nós). */
    static final double KMH_POR_NO = 1.852;

    private Geo() {
    }

    /** Distância em metros entre dois pontos (fórmula de haversine). */
    public static double distanciaMetros(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * RAIO_TERRA_M * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    /** Nós para km/h, com uma casa decimal; nulo continua nulo. */
    public static Double nosParaKmh(Double nos) {
        return nos == null ? null : Math.round(nos * KMH_POR_NO * 10) / 10.0;
    }

    /** Coordenada utilizável: dentro dos limites e diferente de (0, 0), que o GPS usa quando não tem sinal. */
    public static boolean coordenadaValida(Double latitude, Double longitude) {
        return latitude != null && longitude != null
                && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
                && !(latitude == 0 && longitude == 0);
    }
}
