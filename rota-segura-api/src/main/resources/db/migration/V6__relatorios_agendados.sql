-- E-mail do usuário do painel (destino dos relatórios agendados; só o próprio usuário recebe).
alter table usuario add column email varchar(150);

-- Relatórios semanais por e-mail. Filtros são só ids (nenhum dado pessoal).
create table relatorio_agendado (
    id              bigserial primary key,
    usuario_id      bigint      not null references usuario (id) on delete cascade,
    tipo            varchar(20) not null,
    escola_id       bigint,
    dia_semana      integer     not null,
    ativo           boolean     not null default true,
    criado_em       timestamptz not null,
    ultimo_envio_em timestamptz,
    constraint ck_relatorio_tipo check (tipo in ('FREQUENCIA', 'VEICULOS')),
    constraint ck_relatorio_dia check (dia_semana between 1 and 7)
);

create index ix_relatorio_agendado_usuario on relatorio_agendado (usuario_id);
