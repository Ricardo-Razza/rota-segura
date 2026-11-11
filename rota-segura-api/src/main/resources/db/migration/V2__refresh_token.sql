-- Refresh tokens rotativos. Só o hash SHA-256 é guardado; "familia" agrupa a cadeia de rotações de um login.
create table refresh_token (
    id          uuid primary key,
    usuario_id  bigint      not null references usuario (id) on delete cascade,
    token_hash  varchar(64) not null unique,
    familia     uuid        not null,
    criado_em   timestamptz not null,
    expira_em   timestamptz not null,
    usado_em    timestamptz,
    revogado_em timestamptz
);

create index ix_refresh_token_familia on refresh_token (familia);
