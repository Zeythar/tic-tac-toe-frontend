/**
 * Centralized theme gradients for consistent styling across the application.
 * Provides a single source of truth for color gradients used in components.
 */

import { ExtendedModalType } from '../types/modal.types';

/**
 * Application gradient definitions.
 * All gradients use linear-gradient with 135deg angle for consistency.
 */
export const GRADIENTS = {
  // Modal/game state gradients
  win: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)', // emerald to teal
  loss: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', // red gradient
  draw: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', // cyan to blue
  forfeit: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)', // slate gradient
  roomExpired: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', // amber to red
  info: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)', // amber to red (default)

  // Home screen mode card gradients
  pink: 'linear-gradient(135deg, #ec4899 0%, #fb7185 100%)', // pink to rose
  cyan: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)', // cyan to blue
  emerald: 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)', // emerald to teal
} as const;

/**
 * Type-safe gradient key
 */
export type GradientKey = keyof typeof GRADIENTS;

/**
 * Get a gradient value by key.
 *
 * @param key - The gradient identifier
 * @returns CSS linear-gradient string
 *
 * @example
 * ```typescript
 * const winGradient = getGradient('win');
 * // 'linear-gradient(135deg, #10b981 0%, #14b8a6 100%)'
 * ```
 */
export function getGradient(key: GradientKey): string {
  return GRADIENTS[key];
}

/**
 * Map modal type to gradient key.
 * Helper function for modal components.
 *
 * @param modalType - Type of modal (win, loss, draw, forfeit, roomExpired, info, rematch)
 * @returns Gradient key for the modal type
 */
export function getModalGradient(modalType: ExtendedModalType): GradientKey {
  // Map rematch to a friendly gradient (reuse win/emerald)
  if (modalType === 'rematch') return 'emerald';

  // Direct mapping for other types
  return modalType as GradientKey;
}

/**
 * Map game mode to gradient key.
 * Helper function for home screen mode cards.
 *
 * @param mode - Game mode identifier
 * @returns Gradient key for the mode
 */
export function getModeGradient(mode: 'friend' | 'local' | 'ai'): GradientKey {
  const mapping: Record<string, GradientKey> = {
    friend: 'pink',
    local: 'cyan',
    ai: 'emerald',
  };
  return mapping[mode] || 'info';
}

/**
 * Get the full gradient CSS string for a game mode.
 * Convenience function that combines getModeGradient and getGradient.
 *
 * @param mode - Game mode identifier
 * @returns CSS linear-gradient string for the mode
 *
 * @example
 * ```typescript
 * const friendGradient = getModeGradientString('friend');
 * // 'linear-gradient(135deg, #ec4899 0%, #fb7185 100%)'
 * ```
 */
export function getModeGradientString(mode: 'friend' | 'local' | 'ai'): string {
  return getGradient(getModeGradient(mode));
}
