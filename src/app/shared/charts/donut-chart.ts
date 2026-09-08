import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface DonutSegment {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly color: string;
}

interface RenderedSegment extends DonutSegment {
  readonly dash: number;
  readonly gap: number;
  readonly offset: number;
}

/** Ring chart whose arcs are computed from the supplied values. */
@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="relative mx-auto" [style.width.px]="size()" [style.height.px]="size()">
      <svg
        [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
        class="size-full -rotate-90"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        <circle
          [attr.cx]="center()"
          [attr.cy]="center()"
          [attr.r]="radius()"
          fill="none"
          stroke="var(--color-sunken)"
          [attr.stroke-width]="thickness()"
        />
        @for (segment of rendered(); track segment.id) {
          <circle
            [attr.cx]="center()"
            [attr.cy]="center()"
            [attr.r]="radius()"
            fill="none"
            [attr.stroke]="segment.color"
            [attr.stroke-width]="thickness()"
            [attr.stroke-dasharray]="segment.dash + ' ' + segment.gap"
            [attr.stroke-dashoffset]="segment.offset"
            [attr.stroke-linecap]="rounded() ? 'round' : 'butt'"
          />
        }
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
        <ng-content />
      </div>
    </div>
  `,
})
export class DonutChart {
  readonly segments = input.required<readonly DonutSegment[]>();
  readonly size = input(190);
  readonly thickness = input(16);
  readonly rounded = input(true);
  /** Fraction of the circle left empty between segments. */
  readonly gapRatio = input(0.012);
  readonly ariaLabel = input('Category breakdown');

  protected readonly center = computed(() => this.size() / 2);
  protected readonly radius = computed(() => this.size() / 2 - this.thickness() / 2 - 2);
  private readonly circumference = computed(() => 2 * Math.PI * this.radius());

  protected readonly rendered = computed<RenderedSegment[]>(() => {
    const list = this.segments().filter((s) => s.value > 0);
    const total = list.reduce((sum, s) => sum + s.value, 0);
    if (total <= 0) return [];
    const c = this.circumference();
    const gap = c * this.gapRatio();
    let consumed = 0;
    return list.map((segment) => {
      const length = Math.max(0, (segment.value / total) * c - gap);
      const offset = -consumed;
      consumed += length + gap;
      return { ...segment, dash: length, gap: c - length, offset };
    });
  });
}
