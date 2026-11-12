package br.com.rotasegura.jornada.application;

import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.jornada.domain.Leitor;
import br.com.rotasegura.jornada.domain.TipoLeitor;
import br.com.rotasegura.shared.integration.Conversoes;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.springframework.stereotype.Component;

/**
 * Classifica os leitores faciais pelo {@code tipo_de_uso_dispositivo_id} mapeado na configuração.
 * Tipo desconhecido nunca é classificado por palpite: o leitor fica de fora e é reportado.
 */
@Component
public class ClassificadorDeLeitores {

    private final JornadaProperties.TiposLeitor tipos;

    public ClassificadorDeLeitores(JornadaProperties propriedades) {
        this.tipos = propriedades.tiposLeitor();
    }

    public Classificacao classificar(Collection<DispositivoFacialDto> dispositivos) {
        Map<Long, Leitor> leitores = new HashMap<>();
        Set<Long> tipoDesconhecido = new TreeSet<>();
        int semId = 0;
        for (DispositivoFacialDto dispositivo : dispositivos) {
            Long id = Conversoes.paraLong(dispositivo.id());
            if (id == null) {
                semId++;
                continue;
            }
            TipoLeitor tipo = tipoDe(dispositivo.tipoDeUsoDispositivoId());
            if (tipo == null) {
                tipoDesconhecido.add(id);
                continue;
            }
            leitores.put(id, new Leitor(id, tipo,
                    Conversoes.paraLong(dispositivo.veiculoId()), Conversoes.paraLong(dispositivo.escolaId())));
        }
        return new Classificacao(leitores, tipoDesconhecido, semId);
    }

    TipoLeitor tipoDe(String tipoDeUso) {
        if (tipoDeUso == null) {
            return null;
        }
        String valor = tipoDeUso.trim();
        if (tipos.embarque().contains(valor)) {
            return TipoLeitor.EMBARQUE;
        }
        if (tipos.chegada().contains(valor)) {
            return TipoLeitor.CHEGADA;
        }
        return null;
    }

    /**
     * @param leitores         leitores classificados, por id
     * @param tipoDesconhecido ids de leitores cujo tipo não está mapeado (pendência de configuração)
     * @param semId            dispositivos descartados por não terem id numérico
     */
    public record Classificacao(Map<Long, Leitor> leitores, Set<Long> tipoDesconhecido, int semId) {

        public Classificacao {
            leitores = Map.copyOf(leitores);
            tipoDesconhecido = Set.copyOf(tipoDesconhecido);
        }
    }
}
