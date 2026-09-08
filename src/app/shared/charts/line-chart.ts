import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface LinePoint {
  readonly label: string;
  readonly value: number;
}

/**
 * Data driven SVG line chart with a soft area fill.
 * Nothing here is a picture: the path is built from the values passed in.
 */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <figure class="m-0">
      <svg
        [attr.viewBox]="'0 0 ' + width + ' ' + height"
        preserveAspectRatio="none"
        class="block h-[9.5rem] w-full"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        <defs>
          <linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" [attr.stop-color]="color()" stop-opacity="0.42" />
            <stop offset="100%" [attr.stop-color]="color()" stop-opacity="0" />
          </linearGradient>
        </defs>

        @if (comparisonPath()) {
          <path
            [attr.d]="comparisonPath()"
            fill="none"
            stroke="var(--color-ink-faint)"
            stroke-width="2"
            stroke-dasharray="5 6"
            stroke-linecap="round"
            vector-effect="non-scaling-stroke"
          />
        }

        @if (areaPath()) {
          <path [attr.d]="areaPath()" [attr.fill]="'url(#' + gradientId() + ')'" />
        }
        @if (linePath()) {
          <path
            [attr.d]="linePath()"
            fill="none"
            [attr.stroke]="color()"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            vector-effect="non-scaling-stroke"
          />
        }
        @if (lastPoint(); as p) {
          <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4" [attr.fill]="color()" vector-effect="non-scaling-stroke" />
        }
      </svg>
      <div class="mt-2 flex justify-between text-[0.72rem] text-ink-muted">
        @for (tick of ticks(); track tick.label) {
          <span>{{ tick.label }}</span>
        }
      </div>
    </figure>
  `,
})
export class LineChart {
  readonly points = input.required<readonly LinePoint[]>();
  /** Optional dashed reference series, for example a previous period average. */
  readonly comparison = input<readonly number[]>([]);
  readonly color = input('var(--color-accent)');
  readonly ariaLabel = input('Spending over time');
  readonly tickCount = input(6);

  protected readonly width = 300;
  protected readonly height = 120;
  private readonly padding = 6;

  private readonly instanceId = Math.random().toString(36).slice(2, 8);
  protected readonly gradientId = computed(() => `line-fill-${this.instanceId}`);

  private readonly maxValue = computed(() => {
    const values = [...this.points().map((p) => p.value), ...this.comparison()];
    return Math.max(1, ...values);
  });

  private readonly coords = computed(() => this.project(this.points().map((p) => p.value)));
  private readonly comparisonCoords = computed(() => this.project([...this.comparison()]));

  protected readonly linePath = computed(() => smoothPath(this.coords()));
  protected readonly comparisonPath = computed(() =>
    this.comparison().length > 1 ? smoothPath(this.comparisonCoords()) : '',
  );

  protected readonly areaPath = computed(() => {
    const line = this.linePath();
    const coords = this.coords();
    if (!line || coords.length === 0) return '';
    const last = coords[coords.length - 1];
    const first = coords[0];
    return `${line} L ${last.x} ${this.height} L ${first.x} ${this.height} Z`;
  });

  protected readonly lastPoint = computed(() => this.coords().at(-1) ?? null);

  protected readonly ticks = computed(() => {
    const list = this.points();
    if (list.length === 0) return [];
    const count = Math.min(this.tickCount(), list.length);
    const step = Math.max(1, Math.floor((list.length - 1) / Math.max(1, count - 1)));
    const out: LinePoint[] = [];
    for (let i = 0; i < list.length; i += step) out.push(list[i]);
    return out;
  });

  private project(values: readonly number[]): { x: number; y: number }[] {
    if (values.length === 0) return [];
    const max = this.maxValue();
    const usable = this.height - this.padding * 2;
    const span = Math.max(1, values.length - 1);
    return values.map((value, index) => ({
      x: (index / span) * this.width,
      y: this.height - this.padding - (value / max) * usable,
    }));
  }
}

/** Catmull-Rom to cubic bezier, which keeps the curve gentle without overshoot. */
function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${round(c1x)} ${round(c1y)}, ${round(c2x)} ${round(c2y)}, ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
