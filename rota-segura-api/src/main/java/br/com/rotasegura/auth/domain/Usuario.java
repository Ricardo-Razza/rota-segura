package br.com.rotasegura.auth.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/** Usuário do painel (funcionário da rede). Não é aluno nem responsável. */
@Entity
@Table(name = "usuario")
public class Usuario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String login;

    @Column(name = "senha_hash", nullable = false)
    private String senhaHash;

    @Column(nullable = false)
    private String nome;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Perfil perfil;

    @Column(nullable = false)
    private boolean ativo = true;

    @Column(name = "criado_em", nullable = false)
    private Instant criadoEm;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "usuario_escola", joinColumns = @JoinColumn(name = "usuario_id"))
    @Column(name = "escola_id")
    private Set<Long> escolas = new HashSet<>();

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "usuario_veiculo", joinColumns = @JoinColumn(name = "usuario_id"))
    @Column(name = "veiculo_id")
    private Set<Long> veiculos = new HashSet<>();

    protected Usuario() {
    }

    public Usuario(String login, String senhaHash, String nome, Perfil perfil, Instant criadoEm) {
        this.login = login;
        this.senhaHash = senhaHash;
        this.nome = nome;
        this.perfil = perfil;
        this.criadoEm = criadoEm;
    }

    public Usuario comEscolas(Set<Long> ids) {
        this.escolas = new HashSet<>(ids);
        return this;
    }

    public Usuario comVeiculos(Set<Long> ids) {
        this.veiculos = new HashSet<>(ids);
        return this;
    }

    public void desativar() {
        this.ativo = false;
    }

    public Escopo escopo() {
        return new Escopo(id, perfil, escolas, veiculos);
    }

    public Long getId() {
        return id;
    }

    public String getLogin() {
        return login;
    }

    public String getSenhaHash() {
        return senhaHash;
    }

    public String getNome() {
        return nome;
    }

    public Perfil getPerfil() {
        return perfil;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public Set<Long> getEscolas() {
        return Set.copyOf(escolas);
    }

    public Set<Long> getVeiculos() {
        return Set.copyOf(veiculos);
    }

    @Override
    public String toString() {
        return "Usuario[id=" + id + "]";
    }
}
