-- E-mail do usuário do painel (destino dos relatórios agendados; só o próprio usuário recebe).
alter table usuario add column email varchar(150);

-- Relatórios semanais por e-mail. Filtros são só ids (nenhum dado pessoal).
create table relatorio_agendado (
    id              bigint      not null auto_increment primary key,
    usuario_id      bigint      not null,
    tipo            varchar(20) not null,
    escola_id       bigint,
    dia_semana      integer     not null,
    ativo           boolean     not null default true,
    criado_em       datetime(6) not null,
    ultimo_envio_em datetime(6),
    constraint ck_relatorio_tipo check (tipo in ('FREQUENCIA', 'VEICULOS')),
    constraint ck_relatorio_dia check (dia_semana between 1 and 7),
    constraint fk_relatorio_agendado_usuario foreign key (usuario_id) references usuario (id) on delete cascade
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_0900_ai_ci;

create index ix_relatorio_agendado_usuario on relatorio_agendado (usuario_id);
