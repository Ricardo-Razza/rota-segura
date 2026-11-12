package br.com.rotasegura.relatorios.application;

import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.auth.application.EscopoService;
import br.com.rotasegura.auth.application.ExecucaoComoUsuario;
import br.com.rotasegura.auth.domain.Usuario;
import br.com.rotasegura.auth.domain.UsuarioRepository;
import br.com.rotasegura.relatorios.application.RelatoriosService.Exportacao;
import br.com.rotasegura.relatorios.application.RelatoriosService.Formato;
import br.com.rotasegura.relatorios.application.RelatoriosService.Pedido;
import br.com.rotasegura.relatorios.domain.RelatorioAgendado;
import br.com.rotasegura.relatorios.domain.RelatorioAgendadoRepository;
import br.com.rotasegura.relatorios.domain.TipoRelatorio;
import br.com.rotasegura.shared.erro.AcessoNegadoException;
import br.com.rotasegura.shared.erro.RecursoNaoEncontradoException;
import jakarta.mail.internet.MimeMessage;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Relatórios semanais por e-mail, sempre para o próprio usuário (nunca para endereço informado na hora).
 * Sem SMTP configurado ({@code SPRING_MAIL_HOST}), o envio é pulado e registrado em log só com ids.
 */
@Service
public class RelatoriosAgendadosService {

    private static final Logger LOG = LoggerFactory.getLogger(RelatoriosAgendadosService.class);

    private final RelatorioAgendadoRepository agendados;
    private final UsuarioRepository usuarios;
    private final RelatoriosService relatorios;
    private final EscopoService escopo;
    private final ExecucaoComoUsuario comoUsuario;
    private final ObjectProvider<JavaMailSender> email;
    private final Clock relogio;
    private final ZoneId zona;

    public RelatoriosAgendadosService(RelatorioAgendadoRepository agendados, UsuarioRepository usuarios,
                                      RelatoriosService relatorios, EscopoService escopo,
                                      ExecucaoComoUsuario comoUsuario, ObjectProvider<JavaMailSender> email,
                                      Clock relogio, br.com.rotasegura.jornada.application.JornadaProperties jornada) {
        this.agendados = agendados;
        this.usuarios = usuarios;
        this.relatorios = relatorios;
        this.escopo = escopo;
        this.comoUsuario = comoUsuario;
        this.email = email;
        this.relogio = relogio;
        this.zona = jornada.zona();
    }

    @Transactional(readOnly = true)
    public List<Agendamento> meus() {
        return agendados.findByUsuarioIdAndAtivoTrueOrderByIdAsc(escopo.atual().usuarioId()).stream()
                .map(Agendamento::de).toList();
    }

    @Transactional
    public Agendamento agendar(TipoRelatorio tipo, Long escolaId, DayOfWeek dia) {
        if (escolaId != null) {
            escopo.exigirEscola(escolaId);
        }
        Long usuarioId = escopo.atual().usuarioId();
        RelatorioAgendado novo = agendados.save(new RelatorioAgendado(usuarioId,
                tipo == null ? TipoRelatorio.FREQUENCIA : tipo, escolaId, dia == null ? DayOfWeek.MONDAY : dia,
                relogio.instant()));
        return Agendamento.de(novo);
    }

    @Transactional
    public void cancelar(long id) {
        RelatorioAgendado agendado = agendados.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("relatorio-agendado", id));
        if (!agendado.getUsuarioId().equals(escopo.atual().usuarioId())) {
            throw new AcessoNegadoException("Só quem agendou pode cancelar.");
        }
        agendado.desativar();
    }

    @Scheduled(cron = "${rota-segura.relatorios.cron-envio:0 0 7 * * *}", zone = "${rota-segura.jornada.zona:America/Sao_Paulo}")
    @Transactional
    public void enviarDoDia() {
        LocalDate hoje = LocalDate.ofInstant(relogio.instant(), zona);
        for (RelatorioAgendado agendado : agendados.findByAtivoTrueAndDiaSemana(hoje.getDayOfWeek().getValue())) {
            if (agendado.getUltimoEnvioEm() != null
                    && LocalDate.ofInstant(agendado.getUltimoEnvioEm(), zona).equals(hoje)) {
                continue;
            }
            try {
                if (enviar(agendado)) {
                    agendado.registrarEnvio(relogio.instant());
                }
            } catch (RuntimeException e) {
                LOG.warn("Falha no relatório agendado. agendamento={} motivo={}", agendado.getId(),
                        e.getClass().getSimpleName());
            }
        }
    }

    boolean enviar(RelatorioAgendado agendado) {
        JavaMailSender remetente = email.getIfAvailable();
        Usuario usuario = usuarios.findById(agendado.getUsuarioId()).orElse(null);
        if (usuario == null || !usuario.isAtivo() || usuario.getEmail() == null) {
            LOG.info("Relatório agendado sem destinatário válido. agendamento={}", agendado.getId());
            return false;
        }
        if (remetente == null) {
            LOG.info("SMTP não configurado; relatório agendado não enviado. agendamento={}", agendado.getId());
            return false;
        }
        Exportacao exportacao = comoUsuario.executar(usuario, () -> relatorios.exportar(
                new Pedido(agendado.getTipo(), null, null,
                        new FiltroAlunos(null, agendado.getEscolaId(), null, null, null)), Formato.CSV));
        byte[] anexo = RelatoriosService.emBytes(exportacao);
        try {
            MimeMessage mensagem = remetente.createMimeMessage();
            MimeMessageHelper ajudante = new MimeMessageHelper(mensagem, true, "UTF-8");
            ajudante.setTo(usuario.getEmail());
            ajudante.setSubject("Rota Segura · " + exportacao.tabela().titulo() + " (" + exportacao.tabela().periodo() + ")");
            ajudante.setText("Segue em anexo o relatório semanal que você agendou no painel Rota Segura.");
            ajudante.addAttachment(exportacao.nomeArquivo(), new ByteArrayResource(anexo), Formato.CSV.contentType);
            remetente.send(mensagem);
            return true;
        } catch (jakarta.mail.MessagingException e) {
            throw new IllegalStateException("Falha ao montar o e-mail", e);
        }
    }

    public record Agendamento(long id, TipoRelatorio tipo, Long escolaId, DayOfWeek diaSemana, Instant criadoEm,
                              Instant ultimoEnvioEm) {

        static Agendamento de(RelatorioAgendado r) {
            return new Agendamento(r.getId(), r.getTipo(), r.getEscolaId(), r.getDiaSemana(), r.getCriadoEm(),
                    r.getUltimoEnvioEm());
        }
    }
}
