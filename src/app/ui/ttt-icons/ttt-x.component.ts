import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-ttt-x',
  standalone: true,
  template: `
    <svg
      [attr.width]="size"
      [attr.height]="size"
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="X"
    >
      <defs>
        <linearGradient [attr.id]="gradientId" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" [attr.style]="'stop-color: #ec4899; stop-opacity: 1'" />
          <stop offset="100%" [attr.style]="'stop-color: #f43f5e; stop-opacity: 1'" />
        </linearGradient>
      </defs>

      <!-- main X with gradient -->
      <g
        fill="none"
        [attr.stroke]="'url(#' + gradientId + ')'"
        [attr.stroke-width]="strokeWidth"
        stroke-linecap="round"
      >
        <path d="M20 20 L80 80" class="x-line-1" />
        <path d="M80 20 L20 80" class="x-line-2" />
      </g>
    </svg>
  `,
})
export class TttXComponent {
  @Input() color = 'black';

  // unique gradient id per instance
  gradientId = 'x-gradient-' + Math.random().toString(36).slice(2, 9);

  /** Size in pixels or percentage */
  @Input() size: number | string = '100%';

  /** Line thickness */
  @Input() strokeWidth = 8;
}
