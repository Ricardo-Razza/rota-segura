-- Alertas da operação. "chave" = tipo + entidade + janela: no máximo um alerta por chave (deduplicação no banco).
-- A mensagem é gerada dos dados e não leva nome de aluno (só iniciais e id).
create table alerta (
    id                     bigserial primary key,
    chave                  varchar(160) not null,
    tipo                   varchar(40)  not null,
    severidade             varchar(10)  not null,
    entidade_tipo          varchar(20)  not null,
    entidade_id            varchar(40)  not null,
    entidade_rotulo        varchar(80),
    janela                 varchar(20)  not null,
    mensagem               varchar(400) not null,
    escola_id              bigint,
    veiculo_id             bigint,
    status                 varchar(15)  not null,
    ativo                  boolean      not null default true,
    ocorrencias            integer      not null default 1,
    primeira_ocorrencia_em timestamptz  not null,
    ultima_ocorrencia_em   timestamptz  not null,
    assumido_por           bigint,
    assumido_em            timestamptz,
    resolvido_por          bigint,
    resolvido_em           timestamptz,
    comentario             varchar(1000),
    versao                 bigint       not null default 0,
    constraint ck_alerta_status check (status in ('ABERTO', 'EM_ANALISE', 'RESOLVIDO')),
    constraint ck_alerta_severidade check (severidade in ('CRITICO', 'ATENCAO', 'INFO'))
);

create unique index ux_alerta_chave on alerta (chave);
create index ix_alerta_status on alerta (status, severidade);
