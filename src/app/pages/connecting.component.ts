import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';

/**
 * Component shown while establishing connection to game server.
 * Displays a loading spinner and connection message.
 */
@Component({
  selector: 'app-connecting',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="connecting-container">
      <div class="connecting-card">
        <div class="spinner-wrapper">
          <lucide-icon name="Loader2" class="spinner" size="48"></lucide-icon>
        </div>
        <h2 class="connecting-title">Connecting to server...</h2>
        <p class="connecting-message">
          Please wait while we establish a connection to the game server.
        </p>
      </div>
    </div>
  `,
  styles: [
    `
      .connecting-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 60vh;
        padding: 2rem;
      }

      .connecting-card {
        text-align: center;
        max-width: 400px;
        padding: 3rem 2rem;
      }

      .spinner-wrapper {
        display: flex;
        justify-content: center;
        margin-bottom: 2rem;
      }

      .spinner {
        color: rgb(var(--color-primary));
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }

      .connecting-title {
        font-size: 1.75rem;
        font-weight: 700;
        margin-bottom: 0.75rem;
        color: rgb(var(--text-color));
      }

      .connecting-message {
        font-size: 1rem;
        color: rgb(var(--text-secondary));
        line-height: 1.5;
      }
    `,
  ],
})
export class ConnectingComponent {}
