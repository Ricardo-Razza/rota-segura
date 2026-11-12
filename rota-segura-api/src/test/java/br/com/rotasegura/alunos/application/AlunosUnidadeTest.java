package br.com.rotasegura.alunos.application;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.rotasegura.alunos.domain.Iniciais;
import org.junit.jupiter.api.Test;

/** Peças puras do catálogo de alunos. Nomes fictícios. */
class AlunosUnidadeTest {

    @Test
    void iniciaisDoPrimeiroEDoUltimoNome() {
        assertThat(Iniciais.de("ana maria fictícia")).isEqualTo("AF");
        assertThat(Iniciais.de("  Éder  ")).isEqualTo("É");
        assertThat(Iniciais.de("Bia da 2ª Silva")).isEqualTo("BS");
        assertThat(Iniciais.de("")).isEqualTo("?");
        assertThat(Iniciais.de(null)).isEqualTo("?");
        assertThat(Iniciais.de("123")).isEqualTo("?");
    }

    @Test
    void filtroIgnoraCampoNuloEComparaTextoSemCaixa() {
        AlunoResumo aluno = new AlunoResumo(1, "Aluno Fictício", "AF", 900L, "Turma A", "1º ano", "Matutino",
                2026, "Escola Fictícia", 50L, 7L, true);

        assertThat(FiltroAlunos.NENHUM.aceita(aluno)).isTrue();
        assertThat(new FiltroAlunos(null, 50L, "1º ANO", 900L, " matutino ").aceita(aluno)).isTrue();
        assertThat(new FiltroAlunos(null, 60L, null, null, null).aceita(aluno)).isFalse();
        assertThat(new FiltroAlunos(null, null, null, null, "Vespertino").aceita(aluno)).isFalse();
        assertThat(new FiltroAlunos(2025, null, null, null, null).anoLetivoOu(2026)).isEqualTo(2025);
        assertThat(FiltroAlunos.NENHUM.anoLetivoOu(2026)).isEqualTo(2026);
    }

    @Test
    void biometriaSoReconheceValoresConhecidos() {
        assertThat(CatalogoAlunosService.biometria("1")).isTrue();
        assertThat(CatalogoAlunosService.biometria(" Sim ")).isTrue();
        assertThat(CatalogoAlunosService.biometria("0")).isFalse();
        assertThat(CatalogoAlunosService.biometria("não")).isFalse();
        assertThat(CatalogoAlunosService.biometria("talvez")).isNull();
        assertThat(CatalogoAlunosService.biometria(null)).isNull();
    }

    @Test
    void buscaNormalizaAcentoECaixa() {
        assertThat(AlunosService.normalizar("  FICTÍCIO ")).isEqualTo("ficticio");
        assertThat(AlunosService.normalizar(null)).isEmpty();
    }
}
