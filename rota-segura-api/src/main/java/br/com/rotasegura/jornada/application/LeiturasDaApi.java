package br.com.rotasegura.jornada.application;

import br.com.rotasegura.dispositivos.integration.DispositivoFacialDto;
import br.com.rotasegura.dispositivos.integration.DispositivosClient;
import br.com.rotasegura.jornada.application.ClassificadorDeLeitores.Classificacao;
import br.com.rotasegura.jornada.domain.Leitor;
import br.com.rotasegura.jornada.domain.Leitura;
import br.com.rotasegura.jornada.domain.TipoLeitor;
import br.com.rotasegura.presenca.integration.PresencaClient;
import br.com.rotasegura.presenca.integration.PresencaDto;
import br.com.rotasegura.shared.integration.ColecaoPaginada;
import br.com.rotasegura.shared.integration.Conversoes;
import br.com.rotasegura.shared.integration.ResultadoCache;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Lê leitores e leituras da API externa (com o cache dos clientes) e converte para o domínio.
 * É a base comum do motor da jornada, do catálogo de alunos e da saúde dos leitores.
 */
@Component
public class LeiturasDaApi {

    private static final Logger LOG = LoggerFactory.getLogger(LeiturasDaApi.class);

    private final DispositivosClient dispositivos;
    private final PresencaClient presencas;
    private final ClassificadorDeLeitores classificador;
    private final JornadaProperties propriedades;

    public LeiturasDaApi(DispositivosClient dispositivos, PresencaClient presencas,
                         ClassificadorDeLeitores classificador, JornadaProperties propriedades) {
        this.dispositivos = dispositivos;
        this.presencas = presencas;
        this.classificador = classificador;
        this.propriedades = propriedades;
    }

    public Carga carregar() {
        ResultadoCache<ColecaoPaginada<DispositivoFacialDto>> cadastro = dispositivos.listarTodos();
        Classificacao classificacao = classificador.classificar(cadastro.valor().itens());
        if (!classificacao.tipoDesconhecido().isEmpty()) {
            // Só ids: nenhum dado pessoal em log.
            LOG.warn("Leitores com tipo de uso não mapeado (ignorados): {}", classificacao.tipoDesconhecido());
        }

        ResultadoCache<ColecaoPaginada<PresencaDto>> registros = presencas.listarTodas();
        List<Leitura> leituras = new ArrayList<>();
        int semDadosValidos = 0;
        for (PresencaDto registro : registros.valor().itens()) {
            Long alunoId = Conversoes.paraLong(registro.alunoId());
            Long leitorId = Conversoes.paraLong(registro.dispositivoFacialId());
            LocalDateTime dataHora = Conversoes.paraDataHora(registro.dataHora(), propriedades.zona());
            if (alunoId == null || leitorId == null || dataHora == null) {
                semDadosValidos++;
                continue;
            }
            leituras.add(new Leitura(Conversoes.paraLong(registro.id()), alunoId, dataHora, leitorId,
                    Conversoes.paraLong(registro.veiculoId())));
        }
        return new Carga(cadastro.valor().itens(), classificacao, leituras, semDadosValidos,
                cadastro.desatualizado() || registros.desatualizado(),
                cadastro.valor().truncada() || registros.valor().truncada());
    }

    /**
     * Leitores e leituras convertidos.
     *
     * @param dispositivos    cadastro bruto dos leitores (para a tela de saúde)
     * @param leituras        todas as leituras legíveis, de qualquer dia, de leitor classificado ou não
     * @param semDadosValidos registros sem aluno, leitor ou data e hora legíveis
     */
    public record Carga(List<DispositivoFacialDto> dispositivos, Classificacao classificacao, List<Leitura> leituras,
                        int semDadosValidos, boolean desatualizado, boolean incompleto) {

        public Carga {
            dispositivos = List.copyOf(dispositivos);
            leituras = List.copyOf(leituras);
        }

        /**
         * Último vínculo conhecido de cada aluno pelas leituras: a escola e o veículo dos leitores por onde passou.
         * A matrícula da API traz só o nome da escola; o id vem daqui.
         */
        public Map<Long, Vinculo> vinculosRecentes() {
            Map<Long, Vinculo> vinculos = new HashMap<>();
            leituras.stream()
                    .filter(l -> classificacao.leitores().containsKey(l.leitorId()))
                    .sorted(Comparator.comparing(Leitura::dataHora))
                    .forEach(l -> {
                        Leitor leitor = classificacao.leitores().get(l.leitorId());
                        Vinculo anterior = vinculos.getOrDefault(l.alunoId(), Vinculo.NENHUM);
                        Long escola = leitor.escolaId() != null ? leitor.escolaId() : anterior.escolaId();
                        Long veiculo = anterior.veiculoId();
                        if (leitor.tipo() == TipoLeitor.EMBARQUE) {
                            Long doEmbarque = l.veiculoId() != null ? l.veiculoId() : leitor.veiculoId();
                            veiculo = doEmbarque != null ? doEmbarque : veiculo;
                        }
                        vinculos.put(l.alunoId(), new Vinculo(escola, veiculo));
                    });
            return vinculos;
        }
    }

    /** Escola e veículo mais recentes de um aluno; qualquer um pode faltar. */
    public record Vinculo(Long escolaId, Long veiculoId) {

        public static final Vinculo NENHUM = new Vinculo(null, null);
    }
}
