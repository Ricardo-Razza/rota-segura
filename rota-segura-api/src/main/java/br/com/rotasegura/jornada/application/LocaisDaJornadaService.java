package br.com.rotasegura.jornada.application;

import br.com.rotasegura.auth.application.AuditoriaService;
import br.com.rotasegura.auth.domain.AcaoAuditoria;
import br.com.rotasegura.jornada.domain.EstadoJornada;
import br.com.rotasegura.jornada.domain.JornadaDoDia;
import br.com.rotasegura.jornada.domain.Passo;
import br.com.rotasegura.jornada.domain.TipoLeitor;
import br.com.rotasegura.presenca.integration.PresencaClient;
import br.com.rotasegura.presenca.integration.PresencaDto;
import br.com.rotasegura.shared.erro.ApiExternaIndisponivelException;
import br.com.rotasegura.shared.erro.RecursoNaoEncontradoException;
import br.com.rotasegura.shared.integration.Conversoes;
import br.com.rotasegura.shared.integration.ResultadoCache;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Onde o aluno embarcou e chegou num dia: o local de cada leitura vem do detalhe da presença na API externa.
 * <p>
 * O ponto de embarque fica perto da casa da criança, então: só dentro do escopo do usuário, cada consulta é
 * auditada (só o id do aluno), as coordenadas nunca vão para log nem para o banco, e a data vai no caminho
 * da URL, nunca dado pessoal.
 */
@Service
public class LocaisDaJornadaService {

    private final JornadaService jornadas;
    private final JornadasPainelService painel;
    private final PresencaClient presencas;
    private final AuditoriaService auditoria;

    public LocaisDaJornadaService(JornadaService jornadas, JornadasPainelService painel, PresencaClient presencas,
                                  AuditoriaService auditoria) {
        this.jornadas = jornadas;
        this.painel = painel;
        this.presencas = presencas;
        this.auditoria = auditoria;
    }

    public LocaisDoDia doAluno(long alunoId, LocalDate data) {
        painel.exigirAlunoNoEscopo(alunoId);
        LocalDate dia = data != null ? data : jornadas.hoje();
        JornadaDoDia jornada = jornadas.doAluno(alunoId, dia);
        auditoria.registrar(AcaoAuditoria.ACESSO_LOCAL_EMBARQUE, "aluno", alunoId);

        List<LocalDoPasso> locais = new ArrayList<>();
        boolean desatualizado = false;
        boolean incompleto = false;
        for (Passo passo : jornada.passos()) {
            Detalhe detalhe = detalhe(passo.leituraId());
            desatualizado |= detalhe.desatualizado();
            incompleto |= detalhe.indisponivel();
            locais.add(new LocalDoPasso(passo.dataHora(), passo.tipo(), passo.veiculoId(), passo.escolaId(),
                    passo.estadoResultante(), detalhe.latitude(), detalhe.longitude(), detalhe.statusNotificacao()));
        }
        return new LocaisDoDia(alunoId, dia, locais, desatualizado, incompleto);
    }

    private Detalhe detalhe(Long leituraId) {
        if (leituraId == null) {
            return Detalhe.SEM_LOCAL;
        }
        try {
            ResultadoCache<PresencaDto> resultado = presencas.buscarPorId(leituraId);
            PresencaDto p = resultado.valor();
            Double lat = Conversoes.paraDouble(p.latitude());
            Double lon = Conversoes.paraDouble(p.longitude());
            boolean valido = coordenadaValida(lat, lon);
            String status = p.statusNotificacaoDescricao() == null || p.statusNotificacaoDescricao().isBlank()
                    ? null : p.statusNotificacaoDescricao().trim();
            return new Detalhe(valido ? lat : null, valido ? lon : null, status, resultado.desatualizado(), false);
        } catch (RecursoNaoEncontradoException | ApiExternaIndisponivelException e) {
            return new Detalhe(null, null, null, false, true);
        }
    }

    /** Descarta fora da faixa e o 0,0 que leitor sem GPS costuma mandar. */
    static boolean coordenadaValida(Double lat, Double lon) {
        if (lat == null || lon == null) {
            return false;
        }
        if (lat == 0 && lon == 0) {
            return false;
        }
        return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }

    private record Detalhe(Double latitude, Double longitude, String statusNotificacao, boolean desatualizado,
                           boolean indisponivel) {
        static final Detalhe SEM_LOCAL = new Detalhe(null, null, null, false, false);
    }

    /**
     * Um passo da jornada com o local da leitura.
     *
     * @param latitude          nula quando a leitura não trouxe coordenada válida
     * @param statusNotificacao situação do aviso ao responsável, como a API descreve
     */
    public record LocalDoPasso(LocalDateTime dataHora, TipoLeitor tipo, Long veiculoId, Long escolaId,
                               EstadoJornada estadoResultante, Double latitude, Double longitude,
                               String statusNotificacao) {
    }

    /**
     * @param incompleto algum detalhe não pôde ser lido da API externa
     */
    public record LocaisDoDia(long alunoId, LocalDate data, List<LocalDoPasso> passos, boolean desatualizado,
                              boolean incompleto) {
        public LocaisDoDia {
            passos = List.copyOf(passos);
        }
    }
}
