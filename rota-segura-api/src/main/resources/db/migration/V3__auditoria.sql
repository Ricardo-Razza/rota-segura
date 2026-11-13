-- Trilha de auditoria: quem, quando, o quê e de onde. Nunca guarda dado pessoal de aluno ou responsável.
create table auditoria (
    id          bigint      not null auto_increment primary key,
    usuario_id  bigint,
    acao        varchar(40) not null,
    entidade    varchar(40),
    entidade_id varchar(40),
    ip          varchar(45),
    ocorrido_em datetime(6) not null
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_0900_ai_ci;

create index ix_auditoria_usuario on auditoria (usuario_id, ocorrido_em);
create index ix_auditoria_entidade on auditoria (entidade, entidade_id);
