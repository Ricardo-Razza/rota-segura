package br.com.rotasegura.shared.web;

import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.rotasegura.shared.erro.ApiExternaIndisponivelException;
import br.com.rotasegura.shared.erro.RecursoNaoEncontradoException;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

class GlobalExceptionHandlerTest {

    private final MockMvc mvc = MockMvcBuilders.standaloneSetup(new ControllerDeTeste())
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();

    @Test
    void apiExternaIndisponivelVira503ComProblemDetail() throws Exception {
        mvc.perform(get("/teste/indisponivel"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.title").value("Fonte de dados indisponível"))
                .andExpect(jsonPath("$.status").value(503))
                .andExpect(jsonPath("$.recurso").value("alunos"));
    }

    @Test
    void naoEncontradoVira404() throws Exception {
        mvc.perform(get("/teste/nao-encontrado"))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.type").value("urn:rota-segura:erro:nao-encontrado"));
    }

    @Test
    void erroInesperadoVira500SemVazarAMensagem() throws Exception {
        mvc.perform(get("/teste/inesperado"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.detail").value("Ocorreu um erro inesperado."))
                .andExpect(content().string(not(containsString("segredo"))));
    }

    @RestController
    static class ControllerDeTeste {

        @GetMapping("/teste/indisponivel")
        String indisponivel() {
            throw new ApiExternaIndisponivelException("alunos", new IllegalStateException("falha"));
        }

        @GetMapping("/teste/nao-encontrado")
        String naoEncontrado() {
            throw new RecursoNaoEncontradoException("alunos", 99);
        }

        @GetMapping("/teste/inesperado")
        String inesperado() {
            throw new IllegalStateException("segredo interno");
        }
    }
}
