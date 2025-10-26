import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import {
  LucideAngularModule,
  Users,
  Gamepad2,
  Cpu,
  ArrowLeft,
  Share2,
  Check,
  Copy,
  Dices,
  RotateCcw,
  Plus,
  Repeat,
  Home,
  Crown,
  Skull,
  Frown,
  Handshake,
  AlertTriangle,
  Loader2,
  Flag,
  Clock,
  AlertCircle,
  Timer,
} from 'lucide-angular';
import { isDevMode } from '@angular/core';
import { provideServiceWorker } from '@angular/service-worker';

const lucideProviders =
  LucideAngularModule.pick({
    Users,
    Gamepad2,
    Cpu,
    ArrowLeft,
    Share2,
    Check,
    Copy,
    Dices,
    RotateCcw,
    Plus,
    Repeat,
    Home,
    Skull,
    Crown,
    Frown,
    Handshake,
    AlertTriangle,
    Loader2,
    Flag,
    Clock,
    AlertCircle,
    Timer,
  })?.providers ?? [];

bootstrapApplication(App, {
  ...appConfig,
  providers: [
    ...(appConfig.providers ?? []),
    ...lucideProviders,
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
}).catch((err) => console.error(err));
