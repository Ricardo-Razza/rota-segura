-- Usuários do painel e seus escopos (escolas do DIRETOR, veículos do MONITOR).
create table usuario (
    id         bigserial primary key,
    login      varchar(120) not null,
    senha_hash varchar(100) not null,
    nome       varchar(150) not null,
    perfil     varchar(20)  not null,
    ativo      boolean      not null default true,
    criado_em  timestamptz  not null default now(),
    constraint ck_usuario_perfil check (perfil in ('ADMIN', 'GESTAO', 'SECRETARIA', 'DIRETOR', 'MONITOR'))
);

create unique index ux_usuario_login on usuario (lower(login));

create table usuario_escola (
    usuario_id bigint not null references usuario (id) on delete cascade,
    escola_id  bigint not null,
    primary key (usuario_id, escola_id)
);

create table usuario_veiculo (
    usuario_id bigint not null references usuario (id) on delete cascade,
    veiculo_id bigint not null,
    primary key (usuario_id, veiculo_id)
);
