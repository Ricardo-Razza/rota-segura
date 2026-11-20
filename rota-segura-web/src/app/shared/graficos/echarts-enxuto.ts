import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { LabelLayout } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

/**
 * ECharts só com o que os gráficos do painel usam (barras, linhas, rosca, linha de média).
 * O pacote completo tem mais de 1 MB; este fica bem menor e abre mais rápido em máquina fraca.
 * Gráfico novo com outro tipo de série ou componente precisa ser registrado aqui.
 */
echarts.use([
  BarChart,
  LineChart,
  PieChart,
  AriaComponent,
  DatasetComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TitleComponent,
  TooltipComponent,
  LabelLayout,
  CanvasRenderer,
]);

export default echarts;
