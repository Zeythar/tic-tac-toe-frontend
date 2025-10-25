import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../services/toast.service';

/**
 * Global toast/banner component that displays temporary messages.
 * Replaces duplicate implementations (disconnect-banner, copied-message).
 *
 * Add this component to the root app template:
 * ```html
 * <app-toast />
 * ```
 */
@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (toastService.currentToast(); as toast) {
    <div
      class="toast-container"
      [class.toast-info]="toast.type === 'info'"
      [class.toast-success]="toast.type === 'success'"
      [class.toast-warning]="toast.type === 'warning'"
      [class.toast-error]="toast.type === 'error'"
      [class.visible]="!!toast"
    >
      {{ toast.message }}
    </div>
    }
  `,
  styles: [
    `
      .toast-container {
        position: fixed;
        left: 50%;
        bottom: 1rem;
        transform: translateX(-50%) translateY(20px);
        min-width: 200px;
        max-width: calc(100% - 48px);
        padding: 12px 16px;
        text-align: center;
        font-size: 0.95rem;
        opacity: 0;
        pointer-events: none;
        transition: opacity 200ms ease, transform 200ms ease;
        z-index: 9999;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 0.75rem;
        color: white;
      }

      .toast-container.visible {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
        pointer-events: auto;
      }

      .toast-success {
        color: #34d399;
        border-color: rgba(52, 211, 153, 0.3);
      }

      .toast-warning {
        color: #fff8e1;
        border-color: rgba(255, 248, 225, 0.2);
      }

      .toast-error {
        color: #fca5a5;
        border-color: rgba(252, 165, 165, 0.3);
      }

      .toast-info {
        color: #93c5fd;
        border-color: rgba(147, 197, 253, 0.3);
      }
    `,
  ],
})
export class ToastComponent {
  protected readonly toastService = inject(ToastService);
}
