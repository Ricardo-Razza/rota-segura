package br.com.rotasegura.dispositivos.web;

import br.com.rotasegura.dispositivos.application.SaudeLeitoresService;
import br.com.rotasegura.dispositivos.application.SaudeLeitoresService.SaudeDosLeitores;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Leitores faciais (somente leitura, dados da API externa). */
@RestController
@RequestMapping("/api/v1/dispositivos")
@Tag(name = "Leitores faciais")
public class DispositivosController {

    private final SaudeLeitoresService saude;

    public DispositivosController(SaudeLeitoresService saude) {
        this.saude = saude;
    }

    @GetMapping("/saude")
    @Operation(summary = "Online/offline pela última leitura e leituras na última hora, por leitor.")
    SaudeDosLeitores saude() {
        return saude.saude();
    }
}
