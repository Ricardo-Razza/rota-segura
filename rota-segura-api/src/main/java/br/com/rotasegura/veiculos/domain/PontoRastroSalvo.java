package br.com.rotasegura.veiculos.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/**
 * Ponto do trajeto de um ônibus guardado no banco (só veículo, hora local e posição).
 * <p>
 * LGPD: o trajeto passa perto da casa das crianças. Nunca vai para log, só é lido dentro do escopo do
 * usuário e é apagado depois do prazo de retenção.
 */
@Entity
@Table(name = "ponto_rastro")
public class PontoRastroSalvo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "veiculo_id", nullable = false)
    private long veiculoId;

    @Column(name = "registrado_em", nullable = false)
    private LocalDateTime registradoEm;

    @Column(nullable = false)
    private double latitude;

    @Column(nullable = false)
    private double longitude;

    protected PontoRastroSalvo() {
    }

    public PontoRastroSalvo(long veiculoId, LocalDateTime registradoEm, double latitude, double longitude) {
        this.veiculoId = veiculoId;
        this.registradoEm = registradoEm;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public long getVeiculoId() {
        return veiculoId;
    }

    public LocalDateTime getRegistradoEm() {
        return registradoEm;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public RastroDoDia.PontoRastro paraPonto() {
        return new RastroDoDia.PontoRastro(latitude, longitude, registradoEm);
    }
}
