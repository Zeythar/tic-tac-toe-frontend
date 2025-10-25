import { Routes } from '@angular/router';
import { EmptyRouteComponent } from './components/empty-route.component';

// Router is unused by the app's internal navigation. App reads /room/:code
// on startup and handles the flow directly. Provide a catch-all route so the
// Router doesn't error on initial navigation when someone opens /room/:code
// directly — the App component will parse the path and handle joining.
export const routes: Routes = [
  // match anything and leave the URL intact; App will read window.location
  { path: '**', component: EmptyRouteComponent },
];
