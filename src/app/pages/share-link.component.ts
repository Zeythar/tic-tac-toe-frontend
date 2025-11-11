import {
  Component,
  input,
  output,
  inject,
  effect,
  signal,
} from '@angular/core';
import { BackButtonComponent } from '../components/back-button.component';
import { LucideAngularModule } from 'lucide-angular';
import { ToastService } from '../services/toast.service';
import { COPY_FEEDBACK_DURATION_MS } from '../constants/game.constants';
import QRCode from 'qrcode';

/**
 * Component for displaying the share link with copy functionality.
 */
@Component({
  selector: 'app-share-link',
  standalone: true,
  imports: [LucideAngularModule, BackButtonComponent],
  template: `
    <div class="share-container">
      <div class="header-actions">
        <app-back-button (back)="onBack()">Back</app-back-button>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="share-icon-wrapper">
            <lucide-icon name="Share2" class="icon" size="40"></lucide-icon>
          </div>
          <h2 class="card-title">Invite Your Friend</h2>
          <p class="card-subtitle">Share this link to start playing</p>
        </div>

        <div class="share-content">
          <!-- QR Code Display -->
          @if (qrCodeDataUrl()) {
          <div class="qr-code-container">
            <img
              [src]="qrCodeDataUrl()"
              alt="QR Code for game link"
              class="qr-code"
            />
            <p class="qr-note">Scan to join the game</p>
          </div>
          }

          <div class="link-container">
            <div class="link-box">{{ shareLink() }}</div>
            <button
              class="copy-button"
              (click)="onCopyClick()"
              [attr.aria-label]="copied() === true ? 'Copied' : 'Copy link'"
            >
              @if (copied() === true) {
              <lucide-icon name="Check" class="icon" size="16"></lucide-icon>
              } @else {
              <lucide-icon name="Copy" class="icon" size="16"></lucide-icon>
              }
            </button>
          </div>

          <div class="button-section">
            <p class="waiting-note">
              Waiting for your friend to join<span class="dot">.</span
              ><span class="dot">.</span><span class="dot">.</span>
            </p>
            <p class="waiting-note">
              The game will start automatically once they connect.
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./share-link.component.scss'],
})
export class ShareLinkComponent {
  private readonly toastService = inject(ToastService);

  shareLink = input.required<string>();
  copied = input<boolean>(false);
  copyLink = output<void>();

  // Output: event when user clicks back
  back = output<void>();

  // QR code data URL
  qrCodeDataUrl = signal<string | null>(null);

  constructor() {
    // Show toast when copied changes to true
    effect(() => {
      if (this.copied() === true) {
        this.toastService.success(
          'Link copied to clipboard!',
          COPY_FEEDBACK_DURATION_MS
        );
      }
    });

    // Generate QR code when share link changes
    effect(() => {
      const link = this.shareLink();
      if (link) {
        QRCode.toDataURL(link, {
          width: 200,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        })
          .then((url) => {
            this.qrCodeDataUrl.set(url);
          })
          .catch((err) => {
            console.error('Failed to generate QR code:', err);
          });
      }
    });
  }

  onCopyClick(): void {
    this.copyLink.emit();
  }

  onBack(): void {
    this.back.emit();
  }
}
