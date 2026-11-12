-- Execuções de "sincronizar alunos" (GET /api/alunos/sincronizar na API externa): quem disparou, quando e o resultado.
create table sincronizacao_alunos (
    id           bigserial primary key,
    usuario_id   bigint      not null,
    iniciado_em  timestamptz not null,
    concluido_em timestamptz,
    sucesso      boolean,
    http_status  integer,
    erro_tipo    varchar(60)
);

create index ix_sincronizacao_alunos_iniciado on sincronizacao_alunos (iniciado_em desc);
