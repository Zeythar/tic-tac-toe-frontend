import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ttt-circle',
  standalone: true,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="O"
    >
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" [attr.style]="'stop-color: #06b6d4; stop-opacity: 1'" />
          <stop offset="100%" [attr.style]="'stop-color: #3b82f6; stop-opacity: 1'" />
        </linearGradient>
      </defs>
      <circle
        cx="50"
        cy="50"
        r="30"
        fill="none"
        [attr.stroke]="'url(#' + gradientId + ')'"
        [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
      />
    </svg>
  `,
})
export class TttCircleComponent {
  @Input() color = 'black';

  // unique gradient id per instance to avoid collisions when multiple instances exist
  gradientId = 'o-gradient-' + Math.random().toString(36).slice(2, 9);

  /** Size in pixels or percentage */
  @Input() size: number | string = '100%';

  /** Line thickness */
  @Input() strokeWidth = 8;
}
