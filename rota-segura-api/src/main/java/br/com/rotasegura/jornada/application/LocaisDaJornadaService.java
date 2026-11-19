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
import br.com.rotasegura.veiculos.domain.PontoNoMomento;
import br.com.rotasegura.veiculos.domain.PontoRastroSalvo;
import br.com.rotasegura.veiculos.domain.PontoRastroSalvoRepository;
import br.com.rotasegura.veiculos.domain.RastroDoDia.PontoRastro;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Onde o aluno embarcou e chegou num dia: o local de cada leitura vem do detalhe da presença na API externa.
 * <p>
 * O embarque vem do trajeto do ônibus guardado no banco (a API manda a coordenada fixa do leitor). O ponto de
 * embarque fica perto da casa da criança, então: só dentro do escopo do usuário, cada consulta é
 * auditada (só o id do aluno), o local nunca vai para log nem é gravado junto do aluno, e a data vai no caminho
 * da URL, nunca dado pessoal.
 */
@Service
public class LocaisDaJornadaService {

    private final JornadaService jornadas;
    private final JornadasPainelService painel;
    private final PresencaClient presencas;
    private final AuditoriaService auditoria;
    private final PontoRastroSalvoRepository trajetos;

    public LocaisDaJornadaService(JornadaService jornadas, JornadasPainelService painel, PresencaClient presencas,
                                  AuditoriaService auditoria, PontoRastroSalvoRepository trajetos) {
        this.jornadas = jornadas;
        this.painel = painel;
        this.presencas = presencas;
        this.auditoria = auditoria;
        this.trajetos = trajetos;
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
            Double lat = null;
            Double lon = null;
            OrigemLocal origem = null;
            if (passo.tipo() == TipoLeitor.EMBARQUE) {
                // A API manda a coordenada fixa do leitor, não a do momento: o embarque vem do GPS do ônibus.
                Optional<PontoRastro> gps = ondeEstavaOOnibus(passo);
                if (gps.isPresent()) {
                    lat = gps.get().latitude();
                    lon = gps.get().longitude();
                    origem = OrigemLocal.GPS_ONIBUS;
                }
            } else if (detalhe.latitude() != null) {
                lat = detalhe.latitude();
                lon = detalhe.longitude();
                origem = OrigemLocal.LEITOR;
            }
            locais.add(new LocalDoPasso(passo.dataHora(), passo.tipo(), passo.veiculoId(), passo.escolaId(),
                    passo.estadoResultante(), lat, lon, origem, detalhe.statusNotificacao()));
        }
        return new LocaisDoDia(alunoId, dia, locais, desatualizado, incompleto);
    }

    private Optional<PontoRastro> ondeEstavaOOnibus(Passo passo) {
        if (passo.veiculoId() == null) {
            return Optional.empty();
        }
        long veiculo = passo.veiculoId();
        LocalDateTime hora = passo.dataHora();
        PontoRastro antes = trajetos.findFirstByVeiculoIdAndRegistradoEmLessThanEqualOrderByRegistradoEmDesc(
                veiculo, hora).map(PontoRastroSalvo::paraPonto).orElse(null);
        PontoRastro depois = trajetos.findFirstByVeiculoIdAndRegistradoEmGreaterThanEqualOrderByRegistradoEmAsc(
                veiculo, hora).map(PontoRastroSalvo::paraPonto).orElse(null);
        return PontoNoMomento.escolher(hora, antes, depois);
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
     * @param latitude          nula quando não há local confiável (embarque sem trajeto do ônibus guardado)
     * @param origemLocal       de onde veio o local; nula sem local
     * @param statusNotificacao situação do aviso ao responsável, como a API descreve
     */
    public record LocalDoPasso(LocalDateTime dataHora, TipoLeitor tipo, Long veiculoId, Long escolaId,
                               EstadoJornada estadoResultante, Double latitude, Double longitude,
                               OrigemLocal origemLocal, String statusNotificacao) {
    }

    /** De onde veio o local de um passo. */
    public enum OrigemLocal {
        /** Posição do ônibus na hora do embarque, pelo trajeto do rastreador. */
        GPS_ONIBUS,
        /** Coordenada que a API manda com a leitura (no leitor da escola, a própria escola). */
        LEITOR
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
