import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Toasts } from './core/toast/toasts';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Toasts],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <rs-toasts />
  `,
})
export class App {}
