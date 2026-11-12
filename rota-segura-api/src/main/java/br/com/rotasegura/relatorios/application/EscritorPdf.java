package br.com.rotasegura.relatorios.application;

import br.com.rotasegura.relatorios.domain.Tabela;
import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfWriter;
import java.awt.Color;
import java.io.OutputStream;
import java.util.List;

/** PDF simples do relatório (paisagem, cabeçalho repetido em cada página). */
final class EscritorPdf {

    private static final Color VERDE = new Color(0x2F, 0x8A, 0x44);

    private EscritorPdf() {
    }

    static void escrever(Tabela tabela, OutputStream saida) {
        Document documento = new Document(PageSize.A4.rotate(), 28, 28, 28, 28);
        PdfWriter.getInstance(documento, saida);
        documento.open();
        Font titulo = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 14, VERDE);
        Font subtitulo = FontFactory.getFont(FontFactory.HELVETICA, 9, Color.DARK_GRAY);
        Font cabecalho = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8, Color.WHITE);
        Font corpo = FontFactory.getFont(FontFactory.HELVETICA, 8);

        documento.add(new Paragraph("Rota Segura · " + tabela.titulo(), titulo));
        documento.add(new Paragraph("Período: " + tabela.periodo() + " · " + tabela.linhas().size() + " linhas",
                subtitulo));
        documento.add(new Paragraph(" "));

        PdfPTable pdf = new PdfPTable(tabela.colunas().size());
        pdf.setWidthPercentage(100);
        pdf.setHeaderRows(1);
        for (String coluna : tabela.colunas()) {
            PdfPCell celula = new PdfPCell(new Phrase(coluna, cabecalho));
            celula.setBackgroundColor(VERDE);
            celula.setPadding(4);
            pdf.addCell(celula);
        }
        for (List<String> linha : tabela.linhas()) {
            for (String valor : linha) {
                PdfPCell celula = new PdfPCell(new Phrase(valor == null ? "" : valor, corpo));
                celula.setPadding(3);
                celula.setHorizontalAlignment(valor != null && valor.matches("-?\\d+([.,]\\d+)?")
                        ? Element.ALIGN_RIGHT : Element.ALIGN_LEFT);
                pdf.addCell(celula);
            }
        }
        if (tabela.linhas().isEmpty()) {
            PdfPCell vazio = new PdfPCell(new Phrase("Nenhum dado no período.", corpo));
            vazio.setColspan(tabela.colunas().size());
            pdf.addCell(vazio);
        }
        documento.add(pdf);
        documento.close();
    }
}
