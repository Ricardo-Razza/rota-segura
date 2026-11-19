package br.com.rotasegura.auth.domain;

/** Ações que ficam registradas na trilha de auditoria. */
public enum AcaoAuditoria {
    LOGIN,
    LOGIN_FALHA,
    REFRESH_REUTILIZADO,
    ACESSO_PERFIL_ALUNO,
    REVELACAO_CONTATO,
    EXPORTACAO,
    SINCRONIZACAO_ALUNOS,
    ACESSO_LOCAL_EMBARQUE
}
