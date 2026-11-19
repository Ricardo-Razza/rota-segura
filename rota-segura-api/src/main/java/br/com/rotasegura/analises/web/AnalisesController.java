package br.com.rotasegura.analises.web;

import br.com.rotasegura.analises.application.AnalisesService;
import br.com.rotasegura.analises.application.AnalisesService.AnaliseFrequencia;
import br.com.rotasegura.analises.application.AnalisesService.AnaliseFrota;
import br.com.rotasegura.analises.application.AnalisesService.AnaliseMatriculas;
import br.com.rotasegura.analises.application.FiltroAnalise;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Análises de tendência. Todas respeitam o escopo do perfil e os filtros (período, escolas, etapa, turma...). */
@RestController
@RequestMapping("/api/v1/analises")
@Tag(name = "Análises")
public class AnalisesController {

    private final AnalisesService analises;

    public AnalisesController(AnalisesService analises) {
        this.analises = analises;
    }

    @GetMapping("/frequencia")
    @Operation(summary = "Frequência no período: série, comparação e quebras por escola, etapa, turno e dia da semana.")
    AnaliseFrequencia frequencia(FiltroAnalise filtro) {
        return analises.frequencia(filtro);
    }

    @GetMapping("/matriculas")
    @Operation(summary = "Matrículas dos últimos anos letivos, comparação com o ano anterior e cobertura do cadastro.")
    AnaliseMatriculas matriculas(FiltroAnalise filtro) {
        return analises.matriculas(filtro);
    }

    @GetMapping("/frota")
    @Operation(summary = "Embarques, viagens, tempo de trajeto, pontualidade por veículo e alertas do período.")
    AnaliseFrota frota(FiltroAnalise filtro) {
        return analises.frota(filtro);
    }
}
