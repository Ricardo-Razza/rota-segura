package br.com.rotasegura.jornada.domain;

/** Papel do leitor facial na jornada, definido pelo {@code tipo_de_uso_dispositivo_id} mapeado na configuração. */
public enum TipoLeitor {
    /** Leitor no ônibus: o aluno embarcou e ficou vinculado ao veículo. */
    EMBARQUE,
    /** Leitor na escola: o aluno chegou e a presença do dia está confirmada. */
    CHEGADA
}
