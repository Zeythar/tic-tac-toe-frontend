import { Component, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

/**
 * Reusable back button used across multiple screens. Matches the smaller
 * size used in the share-code screen (icon size 16).
 */
@Component({
  selector: 'app-back-button',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <button class="back-button" (click)="onBack()">
      <lucide-icon name="ArrowLeft" class="icon" size="16"></lucide-icon>
      <ng-content></ng-content>
    </button>
  `,
  styles: [
    `
      .back-button {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        background: transparent;
        color: white;
        border: none;
        cursor: pointer;
        font-weight: 500;
        transition: background-color 160ms ease, transform 120ms ease;
      }

      /* Hover and keyboard focus show the subtle background */
      .back-button:hover,
      .back-button:focus-visible {
        background: rgba(255, 255, 255, 0.06);
        outline: none;
      }

      .back-button .icon {
        width: 16px;
        height: 16px;
      }
    `,
  ],
})
export class BackButtonComponent {
  back = output<void>();

  onBack(): void {
    this.back.emit();
  }
}
