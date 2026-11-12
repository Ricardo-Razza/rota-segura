package br.com.rotasegura.dashboard.application;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * @param etapas etapa → anos escolares (como vêm em {@code escola_turma_turma_descricao}), ex.:
 *               {@code INFANTIL: ["Pré I", "Pré II"]}. A API não informa a etapa; sem este mapa
 *               o painel mostra "etapas não configuradas" em vez de uma média única.
 */
@ConfigurationProperties("rota-segura.dashboard")
public record DashboardProperties(Map<String, List<String>> etapas) {

    public DashboardProperties {
        Map<String, List<String>> copia = new LinkedHashMap<>();
        if (etapas != null) {
            etapas.forEach((etapa, anos) -> copia.put(etapa, anos == null ? List.of() : List.copyOf(anos)));
        }
        etapas = copia;
    }

    public boolean etapasConfiguradas() {
        return !etapas.isEmpty();
    }

    public Optional<String> etapaDe(String anoEscolar) {
        if (anoEscolar == null) {
            return Optional.empty();
        }
        String alvo = normalizar(anoEscolar);
        return etapas.entrySet().stream()
                .filter(e -> e.getValue().stream().anyMatch(a -> normalizar(a).equals(alvo)))
                .map(Map.Entry::getKey)
                .findFirst();
    }

    private static String normalizar(String texto) {
        return texto.trim().toLowerCase(Locale.ROOT);
    }
}
