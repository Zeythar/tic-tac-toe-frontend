import { Component, input, output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { getModalGradient, getGradient } from '../utils/theme-gradients.util';
import { ExtendedModalType } from '../types/modal.types';
import { ModalService } from '../services/modal.service';

export interface SystemModalData {
  type: ExtendedModalType;
  title: string;
  message: string;
  code?: string | null;
  isLocal?: boolean;
  offeredByOpponent?: boolean;
  rematchOfferedByMe?: boolean;
  remainingSeconds?: number | null;
  rematchCancelled?: boolean;
}

/**
 * Modal component for displaying game messages (game over, forfeits, expired rooms).
 * Reads modal state from ModalService.
 */
@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    @if (modalData()) {
    <div class="modal-overlay" (click)="onOverlayClick()">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <div class="icon-wrapper" [style.background]="getGradient()">
            @switch (modalData()?.type) { @case ('win') {
            <lucide-icon name="Crown" class="icon" size="40"></lucide-icon>
            } @case ('loss') {
            <lucide-icon name="Frown" class="icon" size="40"></lucide-icon>
            } @case ('draw') {
            <lucide-icon name="Handshake" class="icon" size="40"></lucide-icon>
            } @case ('forfeit') {
            <lucide-icon name="Flag" class="icon" size="40"></lucide-icon>
            } @case ('roomExpired') {
            <lucide-icon name="Clock" class="icon" size="40"></lucide-icon>
            } @default {
            <lucide-icon name="AlertCircle" class="icon" size="40"></lucide-icon>
            } }
          </div>
          <h2 class="modal-title">{{ modalData()?.title }}</h2>
        </div>

        <div class="modal-body">
          <p class="modal-message">{{ modalData()?.message }}</p>
        </div>

        <div class="modal-actions">
          <!-- Action row: Create new game and Return to lobby side-by-side -->
          <div class="action-row">
            <!-- Primary action: local rematch vs online offer -->
            @if (modalData()?.isLocal) {
            <button
              class="btn btn-primary"
              (click)="onRematch()"
              [style.background]="getRematchGradient()"
            >
              <lucide-icon name="RotateCcw" class="btn-icon" size="16"></lucide-icon>
              Rematch
            </button>
            } @else {
            <button
              class="btn btn-primary"
              (click)="modalData()?.offeredByOpponent ? onAcceptRematch() : onOfferRematch()"
              [disabled]="modalData()?.rematchOfferedByMe || modalData()?.rematchCancelled"
              title="Rematch"
              [style.background]="getRematchGradient()"
            >
              <lucide-icon name="RotateCcw" class="btn-icon" size="18"></lucide-icon>
              <span *ngIf="modalData()?.rematchCancelled">Rematch</span>
              <span *ngIf="!modalData()?.rematchCancelled && modalData()?.offeredByOpponent"
                >Accept rematch</span
              >
              <span
                *ngIf="
                  !modalData()?.rematchCancelled &&
                  !modalData()?.offeredByOpponent &&
                  !modalData()?.rematchOfferedByMe
                "
                >Offer Rematch</span
              >
              <span *ngIf="!modalData()?.rematchCancelled && modalData()?.rematchOfferedByMe"
                >Waiting...</span
              >
            </button>
            }

            <button class="btn btn-secondary" (click)="onGoHome()">
              <lucide-icon name="Home" class="btn-icon" size="18"></lucide-icon>
              Return to lobby
            </button>
          </div>
        </div>
      </div>
    </div>
    }
  `,
  styleUrls: ['./modal.component.scss'],
})
export class ModalComponent {
  private readonly modalService = inject(ModalService);

  modal = input<SystemModalData | null>(null);

  protected readonly modalData = computed(() => this.modal() ?? this.modalService.currentModal());

  createGame = output<void>();
  rematch = output<void>();
  offerRematch = output<void>();
  acceptRematch = output<void>();
  declineRematch = output<void>();
  goHome = output<void>();
  dismiss = output<void>();

  onCreateGame(): void {
    this.createGame.emit();
  }

  onRematch(): void {
    this.rematch.emit();
  }

  onOfferRematch(): void {
    this.offerRematch.emit();
  }

  onAcceptRematch(): void {
    this.acceptRematch.emit();
  }

  onDeclineRematch(): void {
    this.declineRematch.emit();
  }

  onGoHome(): void {
    this.goHome.emit();
  }

  onOverlayClick(): void {
    this.dismiss.emit();
  }

  getGradient(): string {
    const type = this.modalData()?.type;
    if (!type) return getGradient('info');
    return getGradient(getModalGradient(type));
  }

  getRematchGradient(): string {
    // Emerald -> teal for local/AI rematch, pink -> red for online rematch
    const emerald = getGradient('emerald');
    const pink = getGradient('pink');
    return this.modalData()?.isLocal ? emerald : pink;
  }
}
