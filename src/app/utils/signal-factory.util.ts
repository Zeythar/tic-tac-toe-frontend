import { signal, Signal } from '@angular/core';

/**
 * Factory for creating signal pairs with a private writable signal and public readonly signal.
 * This reduces boilerplate when creating state properties in services.
 *
 * @example
 * ```typescript
 * class MyService {
 *   private _nameSignal = createSignalPair('');
 *   public readonly name = this._nameSignal.signal;
 *   public setName(value: string) { this._nameSignal.set(value); }
 * }
 * ```
 *
 * @param initialValue - The initial value for the signal
 * @returns Object with readonly signal and setter function
 */
export function createSignalPair<T>(initialValue: T) {
  const _signal = signal<T>(initialValue);
  return {
    /** Readonly signal for public consumption */
    signal: _signal.asReadonly(),
    /** Setter function to update the signal value */
    set: (value: T) => _signal.set(value),
  };
}
