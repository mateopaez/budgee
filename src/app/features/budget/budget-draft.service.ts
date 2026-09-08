import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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

const KEY = 'budgee:budget-draft';

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

/** Keeps the budget creation flow alive while the user moves between steps. */
@Injectable({ providedIn: 'root' })
export class BudgetDraftService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly draftSignal = signal<BudgetDraft>(this.restore());

  readonly draft = this.draftSignal.asReadonly();
  readonly step = computed(() => this.draftSignal().step);

  patch(patch: Partial<BudgetDraft>): void {
    this.draftSignal.update((current) => {
      const next = { ...current, ...patch };
      this.persist(next);
      return next;
    });
  }

  reset(): void {
    const next = emptyDraft();
    this.draftSignal.set(next);
    this.persist(next);
  }

  private restore(): BudgetDraft {
    if (!isPlatformBrowser(this.platformId)) return emptyDraft();
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyDraft();
      return { ...emptyDraft(), ...(JSON.parse(raw) as Partial<BudgetDraft>) };
    } catch {
      return emptyDraft();
    }
  }

  private persist(draft: BudgetDraft): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      // Non fatal: the draft simply will not survive a reload.
    }
  }
}
