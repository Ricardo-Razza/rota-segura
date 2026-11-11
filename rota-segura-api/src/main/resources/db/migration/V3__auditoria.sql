-- Trilha de auditoria: quem, quando, o quê e de onde. Nunca guarda dado pessoal de aluno ou responsável.
create table auditoria (
    id          bigserial primary key,
    usuario_id  bigint,
    acao        varchar(40) not null,
    entidade    varchar(40),
    entidade_id varchar(40),
    ip          varchar(45),
    ocorrido_em timestamptz not null
);

create index ix_auditoria_usuario on auditoria (usuario_id, ocorrido_em);
create index ix_auditoria_entidade on auditoria (entidade, entidade_id);
