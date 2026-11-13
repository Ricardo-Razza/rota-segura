-- Execuções de "sincronizar alunos" (GET /api/alunos/sincronizar na API externa): quem disparou, quando e o resultado.
create table sincronizacao_alunos (
    id           bigint      not null auto_increment primary key,
    usuario_id   bigint      not null,
    iniciado_em  datetime(6) not null,
    concluido_em datetime(6),
    sucesso      boolean,
    http_status  integer,
    erro_tipo    varchar(60)
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_0900_ai_ci;

create index ix_sincronizacao_alunos_iniciado on sincronizacao_alunos (iniciado_em desc);
