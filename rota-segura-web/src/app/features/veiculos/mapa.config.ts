/**
 * Provedor de mapa. Padrão: OpenStreetMap, que não exige chave (nada de marca d'água "API KEY REQUIRED").
 * Outro provedor só entra por configuração de ambiente no build, nunca com chave escrita no código.
 */
export const CONFIG_MAPA = {
  urlTiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  atribuicao: '&copy; colaboradores do OpenStreetMap',
  centro: [-15.78, -47.93] as [number, number],
  zoom: 4,
};
