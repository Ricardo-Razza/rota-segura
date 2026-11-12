package br.com.rotasegura.dashboard.web;

import br.com.rotasegura.alunos.application.FiltroAlunos;
import br.com.rotasegura.dashboard.application.DashboardService;
import br.com.rotasegura.dashboard.application.DashboardService.IndicadoresSensiveis;
import br.com.rotasegura.dashboard.application.DashboardService.ResumoDashboard;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/dashboard")
@Tag(name = "Dashboard")
public class DashboardController {

    private final DashboardService dashboard;

    public DashboardController(DashboardService dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping("/resumo")
    @Operation(summary = "KPIs, frequência por etapa e por escola, matrículas por ano e usuários conectados.")
    ResumoDashboard resumo(FiltroAlunos filtro) {
        return dashboard.resumo(filtro);
    }

    @GetMapping("/sensiveis")
    @PreAuthorize("hasAnyRole('GESTAO','SECRETARIA')")
    @Operation(summary = "Indicadores sensíveis agregados (grupos < 5 suprimidos). Só GESTAO e SECRETARIA.")
    IndicadoresSensiveis sensiveis() {
        return dashboard.sensiveis();
    }
}
