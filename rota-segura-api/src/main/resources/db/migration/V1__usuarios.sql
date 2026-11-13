-- Usuários do painel e seus escopos (escolas do DIRETOR, veículos do MONITOR).
-- MySQL 8.4. Datas em datetime(6) sempre em UTC (hibernate.jdbc.time_zone=UTC).
create table usuario (
    id         bigint       not null auto_increment primary key,
    login      varchar(120) not null,
    senha_hash varchar(100) not null,
    nome       varchar(150) not null,
    perfil     varchar(20)  not null,
    ativo      boolean      not null default true,
    criado_em  datetime(6)  not null default (utc_timestamp(6)),
    constraint ck_usuario_perfil check (perfil in ('ADMIN', 'GESTAO', 'SECRETARIA', 'DIRETOR', 'MONITOR'))
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_0900_ai_ci;

-- Login único sem diferenciar maiúsculas.
create unique index ux_usuario_login on usuario ((lower(login)));

create table usuario_escola (
    usuario_id bigint not null,
    escola_id  bigint not null,
    primary key (usuario_id, escola_id),
    constraint fk_usuario_escola_usuario foreign key (usuario_id) references usuario (id) on delete cascade
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_0900_ai_ci;

create table usuario_veiculo (
    usuario_id bigint not null,
    veiculo_id bigint not null,
    primary key (usuario_id, veiculo_id),
    constraint fk_usuario_veiculo_usuario foreign key (usuario_id) references usuario (id) on delete cascade
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_0900_ai_ci;
