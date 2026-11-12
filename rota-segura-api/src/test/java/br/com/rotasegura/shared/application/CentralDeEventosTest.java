package br.com.rotasegura.shared.application;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotasegura.auth.domain.Escopo;
import br.com.rotasegura.auth.domain.Perfil;
import br.com.rotasegura.shared.application.CentralDeEventos.Evento;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CentralDeEventosTest {

    private final CentralDeEventos central = new CentralDeEventos(new ObjectMapper());

    private static final class Fake implements CentralDeEventos.Assinante {
        final Escopo escopo;
        final List<Evento> recebidos = new ArrayList<>();
        boolean quebrado;

        Fake(Escopo escopo) {
            this.escopo = escopo;
        }

        @Override
        public Escopo escopo() {
            return escopo;
        }

        @Override
        public void enviar(Evento evento) throws IOException {
            if (quebrado) {
                throw new IOException("conexão caiu");
            }
            recebidos.add(evento);
        }

        List<String> tipos() {
            return recebidos.stream().map(Evento::tipo).toList();
        }
    }

    private static Escopo diretor(long escola) {
        return new Escopo(2L, Perfil.DIRETOR, Set.of(escola), Set.of());
    }

    @Test
    void cadaAssinanteRecebeSoOEscopoDele() {
        Fake gestao = new Fake(new Escopo(1L, Perfil.GESTAO, Set.of(), Set.of()));
        Fake diretor50 = new Fake(diretor(50));
        Fake monitor8 = new Fake(new Escopo(3L, Perfil.MONITOR, Set.of(), Set.of(8L)));
        central.registrar(gestao, null);
        central.registrar(diretor50, null);
        central.registrar(monitor8, null);

        central.publicar("jornada.atualizada", Map.of("aluno", 1), 50L, 7L, true);
        central.publicar("jornada.atualizada", Map.of("aluno", 2), 60L, 8L, true);
        central.publicar("presenca.atualizada", Map.of(), null, null, false);

        assertThat(gestao.tipos()).containsExactly("heartbeat", "jornada.atualizada", "jornada.atualizada",
                "presenca.atualizada");
        assertThat(diretor50.recebidos).filteredOn(e -> e.tipo().equals("jornada.atualizada"))
                .extracting(Evento::escolaId).containsExactly(50L);
        assertThat(monitor8.recebidos).filteredOn(e -> e.tipo().equals("jornada.atualizada"))
                .extracting(Evento::veiculoId).containsExactly(8L);
        assertThat(monitor8.tipos()).contains("presenca.atualizada");
    }

    @Test
    void reconexaoRepoeOQueFoiPerdidoComLastEventId() {
        Evento primeiro = central.publicar("alerta.criado", Map.of("id", 1), 50L, null, true);
        central.publicar("alerta.criado", Map.of("id", 2), 50L, null, true);
        central.publicar("alerta.criado", Map.of("id", 3), 60L, null, true);

        Fake voltou = new Fake(diretor(50));
        central.registrar(voltou, String.valueOf(primeiro.id()));

        assertThat(voltou.recebidos).extracting(Evento::dados).containsExactly("{\"id\":2}");
    }

    @Test
    void conexaoQuebradaSaiDaListaEContaConectadosPorPerfil() {
        Fake a = new Fake(new Escopo(1L, Perfil.GESTAO, Set.of(), Set.of()));
        Fake b = new Fake(new Escopo(1L, Perfil.GESTAO, Set.of(), Set.of()));
        Fake c = new Fake(diretor(50));
        central.registrar(a, null);
        central.registrar(b, null);
        central.registrar(c, null);

        assertThat(central.conectadosPorPerfil()).containsEntry(Perfil.GESTAO, 1L).containsEntry(Perfil.DIRETOR, 1L);

        c.quebrado = true;
        central.heartbeat();
        assertThat(central.conexoes()).isEqualTo(2);
        assertThat(central.conectadosPorPerfil()).containsEntry(Perfil.DIRETOR, 0L);
    }
}
