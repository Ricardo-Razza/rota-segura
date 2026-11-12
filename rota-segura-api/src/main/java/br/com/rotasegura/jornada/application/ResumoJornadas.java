package br.com.rotasegura.jornada.application;

import br.com.rotasegura.jornada.domain.JornadaDoDia;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

/**
 * Jornadas de um dia e o que ficou de fora.
 *
 * @param avaliadoEm                  momento (horário local) usado para as regras de tempo
 * @param leitoresComTipoDesconhecido pendência de configuração: mapear em {@code rota-segura.jornada.tipos-leitor}
 * @param desatualizado               algum dado veio do último valor em cache porque a API externa falhou
 * @param incompleto                  a paginação parou no limite de páginas antes do fim
 */
public record ResumoJornadas(
        LocalDate data,
        LocalDateTime avaliadoEm,
        List<JornadaDoDia> jornadas,
        Descartes descartes,
        Set<Long> leitoresComTipoDesconhecido,
        boolean desatualizado,
        boolean incompleto) {

    public ResumoJornadas {
        jornadas = List.copyOf(jornadas);
        leitoresComTipoDesconhecido = Set.copyOf(leitoresComTipoDesconhecido);
    }

    /**
     * Leituras do dia que não entraram em nenhuma jornada, por motivo.
     *
     * @param duplicadas          mesmo aluno, mesmo leitor, dentro do intervalo de duplicidade
     * @param foraDeOrdem         não cabem na sequência (ex.: embarque depois da chegada)
     * @param tipoDeLeitorDesconhecido leitor existe, mas o tipo de uso não está mapeado
     * @param leitorNaoCadastrado leitor que não aparece em {@code dispositivos_faciais}
     * @param semDadosValidos     sem aluno, leitor ou data e hora legíveis
     */
    public record Descartes(int duplicadas, int foraDeOrdem, int tipoDeLeitorDesconhecido,
                            int leitorNaoCadastrado, int semDadosValidos) {

        public int total() {
            return duplicadas + foraDeOrdem + tipoDeLeitorDesconhecido + leitorNaoCadastrado + semDadosValidos;
        }
    }
}
