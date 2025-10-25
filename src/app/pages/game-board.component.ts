import { Component, input, output } from '@angular/core';
import { TttCircleComponent } from '../ui/ttt-icons/ttt-circle.component';
import { TttXComponent } from '../ui/ttt-icons/ttt-x.component';
import { LucideAngularModule } from 'lucide-angular';
import { BackButtonComponent } from '../components/back-button.component';

/**
 * Game board component with countdown banner, match header, and board grid
 * Remains visible even if opponent disconnects mid-match
 */
@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [TttCircleComponent, TttXComponent, LucideAngularModule, BackButtonComponent],
  template: `
    <div
      class="game-container"
      [class.disconnected]="gameMode() === 'friend' && !opponentPresent()"
    >
      <!-- Header actions: Back and Reset buttons -->
      <div class="header-actions">
        @if (gameMode() !== 'friend') {
        <app-back-button (back)="onBack()">Back</app-back-button>
        } @if (gameMode() === 'local' || gameMode() === 'ai') {
        <button class="action-button" (click)="onReset()">
          <lucide-icon name="RotateCcw" class="icon" size="16"></lucide-icon>
          Reset
        </button>
        }
      </div>

      <!-- Main game card -->
      <div class="card">
        <!-- Card header with game mode and turn indicator -->
        <div class="card-header">
          <h2 class="game-title">{{ getGameModeTitle() }}</h2>
        </div>

        <!-- Game board grid -->
        <div class="board-grid">
          @for (cell of board(); track $index) {
          <button
            class="board-cell"
            (click)="onCellClick($index)"
            [disabled]="isGameOver() || !!cell"
          >
            <div class="cell-overlay"></div>
            @if (cell) {
            <div class="cell-icon">
              @if (cell === 'X' || cell === 'x') {
              <app-ttt-x [strokeWidth]="18"></app-ttt-x>
              } @else if (cell === 'O' || cell === 'o') {
              <app-ttt-circle [strokeWidth]="18"></app-ttt-circle>
              }
            </div>
            }
          </button>
          }
        </div>

        <!-- Player info section -->
        <div class="player-info-section">
          <div class="players-display">
            <div class="player-info player-x" [class.active]="currentTurn() === 'X'">
              <div class="player-row">
                <div class="icon-wrapper">
                  <app-ttt-x [strokeWidth]="10"></app-ttt-x>
                </div>
                <span class="player-name">Player X</span>
              </div>
              <div class="player-role">{{ getPlayerRole('X') }}</div>

              <!-- Timer merged into player info for Player X (always show bar) -->
              <div class="player-timer">
                <div class="timer-display-inline">
                  <lucide-icon name="Timer" class="timer-icon" size="16"></lucide-icon>
                  <span class="timer-seconds">{{ formatSeconds('X') }}</span>
                </div>
                <div class="timer-progress-wrapper">
                  <div
                    class="timer-progress player-x"
                    [style.width.%]="getBarPercentFor('X')"
                  ></div>
                </div>
              </div>
            </div>

            <div class="player-divider"></div>

            <div class="player-info player-o" [class.active]="currentTurn() === 'O'">
              <div class="player-row">
                <div class="icon-wrapper">
                  <app-ttt-circle [strokeWidth]="10"></app-ttt-circle>
                </div>
                <span class="player-name">Player O</span>
              </div>
              <div class="player-role">{{ getPlayerRole('O') }}</div>

              <!-- Timer merged into player info for Player O (always show bar) -->
              <div class="player-timer">
                <div class="timer-display-inline" style="text-align: right;">
                  <lucide-icon name="Timer" class="timer-icon" size="16"></lucide-icon>
                  <span class="timer-seconds">{{ formatSeconds('O') }}</span>
                </div>
                <div class="timer-progress-wrapper">
                  <div
                    class="timer-progress player-o"
                    [style.width.%]="getBarPercentFor('O')"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./game-board.component.scss'],
})
export class GameBoardComponent {
  // Game state inputs
  board = input.required<Array<string | null>>();
  mySymbol = input<string | null>(null);
  currentTurn = input<string | null>(null);
  isGameOver = input<boolean>(false);
  winner = input<string | null>(null);
  opponentPresent = input<boolean>(false);

  // Disconnect state inputs
  disconnectedPlayerId = input<string | null>(null);
  countdownSeconds = input<number | null>(null);

  // Turn countdown inputs
  myTurnCountdown = input<number | null>(null);
  opponentTurnCountdown = input<number | null>(null);

  // Error message input
  moveError = input<string | null>(null);

  // Game mode input (for display)
  gameMode = input<string>('friend');

  // Output: when user clicks a cell
  cellClick = output<number>();

  // Output: when user clicks back
  back = output<void>();
  // Output: when user clicks reset
  reset = output<void>();

  getGameModeTitle(): string {
    const mode = this.gameMode();
    if (mode === 'friend') return 'Playing with Friend';
    if (mode === 'local') return 'Local Multiplayer';
    if (mode === 'ai') return 'Playing vs AI';
    return 'Tic Tac Toe';
  }

  getCurrentPlayer(): string {
    return this.currentTurn() || 'X';
  }

  onCellClick(index: number): void {
    this.cellClick.emit(index);
  }

  onBack(): void {
    this.back.emit();
  }

  onReset(): void {
    this.reset.emit();
  }

  getProgressPercent(countdown: number | null): number {
    if (countdown === null) return 100;
    const maxTime = 30;
    return Math.max(0, Math.min(100, (countdown / maxTime) * 100));
  }

  private getCountdownFor(player: 'X' | 'O'): number | null {
    // Determine which countdown belongs to the given player relative to mySymbol.
    // For hotseat/local play `mySymbol()` may be null; in that case treat X as
    // the 'local' (my) player so the UI shows one active countdown at a time.
    const mySym = this.mySymbol();
    if (mySym === null || typeof mySym === 'undefined') {
      return player === 'X' ? this.myTurnCountdown() : this.opponentTurnCountdown();
    }
    if (player === 'X')
      return mySym === 'X' ? this.myTurnCountdown() : this.opponentTurnCountdown();
    return mySym === 'O' ? this.myTurnCountdown() : this.opponentTurnCountdown();
  }

  formatSeconds(player: 'X' | 'O'): string {
    const count = this.getCountdownFor(player);
    if (count === null) return '0s';
    // If the game is over and the player lost by timeout, ensure it reads 0s
    if (this.isGameOver() && this.winner() && this.winner() !== player) {
      // If game over and other player is winner, and timeout likely caused it, clamp to 0
      return '0s';
    }
    return `${Math.max(0, Math.floor(count))}s`;
  }

  getBarPercentFor(player: 'X' | 'O'): number {
    // If game over and player lost, empty the bar
    if (this.isGameOver() && this.winner() && this.winner() !== player) return 0;
    const count = this.getCountdownFor(player);
    return this.getProgressPercent(count);
  }

  getPlayerRole(player: 'X' | 'O'): string {
    const mySym = this.mySymbol();
    const mode = this.gameMode();

    // For local/AI modes, always show roles based on turn
    if (mode === 'local') {
      return player === 'X' ? 'Player 1' : 'Player 2';
    }

    if (mode === 'ai') {
      return player === 'X' ? 'You' : 'AI';
    }

    // For online play, wait for server to assign symbol
    if (mySym === null || typeof mySym === 'undefined') {
      return 'Waiting...';
    }

    return mySym === player ? 'You' : 'Opponent';
  }
}
