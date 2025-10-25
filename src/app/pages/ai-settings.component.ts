import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BackButtonComponent } from '../components/back-button.component';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-ai-settings',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, BackButtonComponent],
  template: `
    <div class="share-container">
      <div class="header-actions">
        <app-back-button (back)="onBack()">Back</app-back-button>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="share-icon-wrapper ai">
            <lucide-icon name="Cpu" class="icon" size="40"></lucide-icon>
          </div>
          <h2 class="card-title">Game Settings</h2>
          <p class="card-subtitle">Choose AI difficulty</p>
        </div>

        <div class="share-content">
          <div class="button-section">
            <div class="difficulty-buttons">
              <button
                type="button"
                class="difficulty-btn"
                [class.active]="selected === 'easy'"
                (click)="selectAndStart('easy')"
                aria-label="Start Easy mode"
              >
                <lucide-icon name="Dices" class="icon" size="16"></lucide-icon>
                <span>Easy Mode</span>
              </button>

              <button
                type="button"
                class="difficulty-btn hard"
                [class.active]="selected === 'hard'"
                (click)="selectAndStart('hard')"
                aria-label="Start Hard mode"
              >
                <lucide-icon name="Skull" class="icon" size="16"></lucide-icon>
                <span>Hard Mode</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./ai-settings.component.scss'],
})
export class AiSettingsComponent {
  selected: 'easy' | 'hard' = 'easy';

  // Outputs
  start = output<'easy' | 'hard'>();
  back = output<void>();

  set(v: 'easy' | 'hard') {
    this.selected = v;
  }

  onStart(): void {
    this.start.emit(this.selected);
  }

  selectAndStart(v: 'easy' | 'hard') {
    this.selected = v;
    this.start.emit(this.selected);
  }

  onBack(): void {
    this.back.emit();
  }
}
