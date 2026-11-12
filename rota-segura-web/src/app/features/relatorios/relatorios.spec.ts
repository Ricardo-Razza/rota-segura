import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { periodoDoPreset } from '../../shared/ui/date-range-picker';
import { Relatorios } from './relatorios';

describe('Relatórios', () => {
  it('já abre com "7 dias" e pede a prévia sem esperar o usuário escolher datas', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Relatorios);
    fixture.detectChanges();
    await fixture.whenStable();

    const esperado = periodoDoPreset('7dias');
    const previa = http.expectOne('/api/v1/relatorios/previa');
    expect(previa.request.method).toBe('POST');
    expect(previa.request.body).toMatchObject({
      tipo: 'FREQUENCIA',
      dataInicio: esperado.inicio,
      dataFim: esperado.fim,
    });
    previa.flush({
      tabela: { titulo: 'Frequência por aluno', periodo: 'x', colunas: ['ID'], linhas: [['1']] },
      totalLinhas: 1,
    });
    http.expectOne('/api/v1/relatorios/agendados').flush([]);
    fixture.detectChanges();

    const botoes = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].map((b) =>
      b.textContent?.trim(),
    );
    expect(botoes).toContain('Exportar CSV');
    const csv = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find((b) =>
      b.textContent?.includes('CSV'),
    )!;
    expect(csv.disabled).toBe(false);
    http.verify();
  });
});
