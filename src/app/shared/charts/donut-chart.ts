import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface DonutSegment {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly color: string;
}

interface RenderedSegment extends DonutSegment {
  readonly d: string;
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
        class="size-full"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        @if (rendered().length === 0) {
          <circle
            [attr.cx]="center()"
            [attr.cy]="center()"
            [attr.r]="radius()"
            fill="none"
            stroke="var(--color-sunken)"
            [attr.stroke-width]="thickness()"
          />
        }
        @for (segment of rendered(); track segment.id) {
          <path
            [attr.d]="segment.d"
            fill="none"
            [attr.stroke]="segment.color"
            [attr.stroke-width]="thickness()"
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
  /** Visible empty space between neighboring segments, as a fraction of the ring. */
  readonly gapRatio = input(0.006);
  readonly ariaLabel = input('Category breakdown');

  protected readonly center = computed(() => this.size() / 2);
  protected readonly radius = computed(() => this.size() / 2 - this.thickness() / 2 - 2);

  protected readonly rendered = computed<RenderedSegment[]>(() => {
    const list = this.segments().filter((s) => s.value > 0);
    const total = list.reduce((sum, s) => sum + s.value, 0);
    if (total <= 0) return [];

    const cx = this.center();
    const cy = this.center();
    const r = this.radius();
    const multi = list.length > 1;
    const gapAngle = multi ? this.gapRatio() * Math.PI * 2 : 0;
    // Round caps sit on the path endpoints and extend along the arc by
    // thickness/2, so inset the path by that amount on each end.
    const capAngle = multi && this.rounded() ? this.thickness() / 2 / r : 0;

    // Start at 12 o'clock; increasing angle draws clockwise in SVG coords.
    let cursor = -Math.PI / 2;
    const out: RenderedSegment[] = [];

    for (const segment of list) {
      const share = (segment.value / total) * Math.PI * 2;
      const visualSpan = Math.max(0, share - gapAngle);
      const pathStart = cursor + capAngle;
      const pathEnd = cursor + visualSpan - capAngle;
      cursor += share;

      if (pathEnd - pathStart <= 0.001) continue;
      out.push({ ...segment, d: arcPath(cx, cy, r, pathStart, pathEnd) });
    }

    return out;
  });
}

/** Open arc from start→end (radians). Sweep=1 = clockwise on screen in SVG. */
function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}
