import { Component, EventEmitter, Output, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { getModeGradientString } from '../utils/theme-gradients.util';
import { NetworkService } from '../services/network.service';
import { ToastService } from '../services/toast.service';

/**
 * Home screen where users choose their game mode.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="home-container">
      <div class="home-header">
        <h1 class="title">Tic-Tac-Toe</h1>
        <p class="subtitle">Choose your game mode</p>
      </div>

      <div class="modes-grid">
        @for (mode of gameModes; track mode.id; let i = $index) {
        <div class="mode-card" [style.animation-delay]="getCardDelay(i)">
          <div
            role="button"
            [tabindex]="isDisabled(mode.id) ? -1 : 0"
            (click)="selectMode(mode.id)"
            (keyup.enter)="selectMode(mode.id)"
            class="card"
            [class.disabled]="isDisabled(mode.id)"
            [attr.aria-disabled]="isDisabled(mode.id)"
          >
            <div class="card-inner">
              <div class="icon-wrap" [ngStyle]="{ background: getGradientForMode(mode.id) }">
                @switch (mode.id) { @case ('friend') {
                <lucide-icon name="Users" class="icon" size="32"></lucide-icon>
                } @case ('local') {
                <lucide-icon name="Gamepad2" class="icon" size="32"></lucide-icon>
                } @default {
                <lucide-icon name="Cpu" class="icon" size="32"></lucide-icon>
                } }
              </div>
              <h3 class="mode-title">{{ mode.title }}</h3>
              <p class="mode-desc">{{ mode.description }}</p>
            </div>
            <div class="card-overlay"></div>
          </div>
        </div>
        }
      </div>
    </div>
  `,
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  private readonly networkService = inject(NetworkService);
  private readonly toastService = inject(ToastService);

  @Output('playAgainstFriend') modeSelected = new EventEmitter<string>();

  protected readonly isOnline = this.networkService.isOnline;

  gameModes = [
    {
      id: 'friend' as const,
      title: 'Play against a friend',
      description: 'Challenge a friend online',
    },
    {
      id: 'local' as const,
      title: 'Play locally',
      description: 'Two players on one device',
    },
    {
      id: 'ai' as const,
      title: 'Play against AI',
      description: 'Challenge the computer',
    },
  ];

  constructor() {
    // Show persistent offline toast on home screen when offline
    effect(() => {
      const online = this.isOnline();

      if (!online) {
        this.toastService.info('Offline Mode', 0); // 0 = persistent
      } else {
        // Hide toast when back online
        const currentToast = this.toastService.currentToast();
        if (currentToast?.message === 'Offline Mode') {
          this.toastService.hide();
        }
      }
    });
  }

  selectMode(id: string) {
    // Don't allow selecting friend mode when offline
    if (this.isDisabled(id)) {
      return;
    }
    this.modeSelected.emit(id);
  }

  isDisabled(modeId: string): boolean {
    // Disable "Play against a friend" when offline
    return modeId === 'friend' && !this.isOnline();
  }

  getCardDelay(index: number): string {
    // React motion: delay: 0.4 + index * 0.1
    return `${0.4 + index * 0.1}s`;
  }

  getGradientForMode(modeId: 'friend' | 'local' | 'ai'): string {
    return getModeGradientString(modeId);
  }
}
