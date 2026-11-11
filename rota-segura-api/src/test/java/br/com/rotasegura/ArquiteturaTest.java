package br.com.rotasegura;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;
import org.springframework.http.HttpMethod;
import org.springframework.web.client.RestClient;

/** Regras de arquitetura do CLAUDE.md (seção 4, regras 4 e 8). */
@AnalyzeClasses(packages = "br.com.rotasegura", importOptions = ImportOption.DoNotIncludeTests.class)
class ArquiteturaTest {

    @ArchTest
    static final ArchRule web_nunca_acessa_integration = noClasses()
            .that().resideInAPackage("br.com.rotasegura..web..")
            .should().dependOnClassesThat().resideInAPackage("br.com.rotasegura..integration..");

    @ArchTest
    static final ArchRule integration_nao_depende_das_camadas_de_cima = noClasses()
            .that().resideInAPackage("br.com.rotasegura..integration..")
            .should().dependOnClassesThat().resideInAnyPackage("br.com.rotasegura..domain..", "br.com.rotasegura..application..", "br.com.rotasegura..web..");

    @ArchTest
    static final ArchRule domain_nao_depende_de_application_nem_web = noClasses()
            .that().resideInAPackage("br.com.rotasegura..domain..")
            .should().dependOnClassesThat().resideInAnyPackage("br.com.rotasegura..application..", "br.com.rotasegura..web..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule application_nao_depende_de_web = noClasses()
            .that().resideInAPackage("br.com.rotasegura..application..")
            .should().dependOnClassesThat().resideInAPackage("br.com.rotasegura..web..")
            .allowEmptyShould(true);

    @ArchTest
    static final ArchRule somente_get_na_api_externa = noClasses()
            .should().callMethod(RestClient.class, "post")
            .orShould().callMethod(RestClient.class, "put")
            .orShould().callMethod(RestClient.class, "patch")
            .orShould().callMethod(RestClient.class, "delete")
            .orShould().callMethod(RestClient.class, "method", HttpMethod.class);

    @ArchTest
    static final ArchRule dtos_sao_records = classes()
            .that().haveSimpleNameEndingWith("Dto")
            .should().beRecords();
}
