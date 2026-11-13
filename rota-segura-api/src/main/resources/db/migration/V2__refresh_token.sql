-- Refresh tokens rotativos. Só o hash SHA-256 é guardado; "familia" agrupa a cadeia de rotações de um login.
-- UUIDs em binary(16), como o Hibernate grava no MySQL.
create table refresh_token (
    id          binary(16)  not null primary key,
    usuario_id  bigint      not null,
    token_hash  varchar(64) not null,
    familia     binary(16)  not null,
    criado_em   datetime(6) not null,
    expira_em   datetime(6) not null,
    usado_em    datetime(6),
    revogado_em datetime(6),
    constraint ux_refresh_token_hash unique (token_hash),
    constraint fk_refresh_token_usuario foreign key (usuario_id) references usuario (id) on delete cascade
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_0900_ai_ci;

create index ix_refresh_token_familia on refresh_token (familia);
