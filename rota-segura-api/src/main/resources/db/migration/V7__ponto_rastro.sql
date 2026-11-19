-- Trajeto dos ônibus pelo GPS do rastreador: só veículo, hora e posição (nenhum dado de aluno).
-- Serve para achar onde o ônibus estava na hora de cada embarque. Apagado depois de 90 dias
-- (rota-segura.rastreamento.retencao).
create table ponto_rastro (
    id           bigint      not null auto_increment primary key,
    veiculo_id   bigint      not null,
    registrado_em datetime(6) not null,
    latitude     double      not null,
    longitude    double      not null
) engine = InnoDB default charset = utf8mb4 collate = utf8mb4_0900_ai_ci;

create index ix_ponto_rastro_veiculo_hora on ponto_rastro (veiculo_id, registrado_em);
create index ix_ponto_rastro_hora on ponto_rastro (registrado_em);
