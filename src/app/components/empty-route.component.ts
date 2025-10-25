import { Component } from '@angular/core';

/**
 * Minimal component used as a target for wildcard routes so the router
 * doesn't rewrite the URL or throw on unknown paths. It intentionally
 * renders nothing — App handles UI rendering and startup join logic.
 */
@Component({
  selector: 'app-empty-route',
  standalone: true,
  template: ``,
})
export class EmptyRouteComponent {}
