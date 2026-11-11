package br.com.rotasegura.auth.web;

import br.com.rotasegura.auth.domain.Perfil;
import br.com.rotasegura.auth.domain.Usuario;
import java.util.List;

/** Dados do usuário do painel para o frontend (menu, rodapé e guardas de rota). */
public record UsuarioResponse(Long id, String nome, Perfil perfil, List<Long> escolas, List<Long> veiculos,
                              boolean podeRevelarContato, boolean podeVerIndicadoresSensiveis) {

    static UsuarioResponse de(Usuario usuario) {
        return new UsuarioResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getPerfil(),
                usuario.getEscolas().stream().sorted().toList(),
                usuario.getVeiculos().stream().sorted().toList(),
                usuario.getPerfil().podeRevelarContato(),
                usuario.getPerfil().podeVerIndicadoresSensiveis());
    }
}
