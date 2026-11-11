export type Perfil = 'ADMIN' | 'GESTAO' | 'SECRETARIA' | 'DIRETOR' | 'MONITOR';

export interface Usuario {
  id: number;
  nome: string;
  perfil: Perfil;
  escolas: number[];
  veiculos: number[];
  podeRevelarContato: boolean;
  podeVerIndicadoresSensiveis: boolean;
}

export interface RespostaToken {
  accessToken: string;
  expiraEmSegundos: number;
  usuario: Usuario;
}

export const ROTULO_PERFIL: Record<Perfil, string> = {
  ADMIN: 'Administrador',
  GESTAO: 'Gestão',
  SECRETARIA: 'Secretaria',
  DIRETOR: 'Diretor',
  MONITOR: 'Monitor',
};

export const API = '/api/v1';
