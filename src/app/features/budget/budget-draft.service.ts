import { Injectable, computed, signal } from '@angular/core';
import type { BudgetPeriodType } from '../../core/models';

export interface BudgetDraftIncome {
  readonly categoryId: string;
  readonly amount: string;
}

export interface BudgetDraft {
  readonly step: number;
  readonly name: string;
  readonly icon: string;
  readonly periodType: BudgetPeriodType;
  readonly monthlyStartDay: number;
  readonly weekStartsOn: number;
  readonly semiMonthlyDays: [number, number];
  readonly yearlyStartMonth: number;
  readonly incomes: readonly BudgetDraftIncome[];
  readonly categoryIds: readonly string[];
}

export function emptyDraft(): BudgetDraft {
  return {
    step: 0,
    name: 'My Household',
    icon: 'home',
    periodType: 'monthly',
    monthlyStartDay: 1,
    weekStartsOn: 5,
    semiMonthlyDays: [1, 16],
    yearlyStartMonth: 1,
    incomes: [],
    categoryIds: [],
  };
}

/**
 * Keeps the budget creation flow alive while the user moves between steps.
 * In-memory only — wizard state is not application data and is not persisted.
 */
@Injectable({ providedIn: 'root' })
export class BudgetDraftService {
  private readonly draftSignal = signal<BudgetDraft>(emptyDraft());

  readonly draft = this.draftSignal.asReadonly();
  readonly step = computed(() => this.draftSignal().step);

  patch(patch: Partial<BudgetDraft>): void {
    this.draftSignal.update((current) => ({ ...current, ...patch }));
  }

  reset(): void {
    this.draftSignal.set(emptyDraft());
  }
}
