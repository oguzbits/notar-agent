import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Kombiniert Klassen mit clsx und löst Tailwind-Konflikte deterministisch via tailwind-merge auf.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
