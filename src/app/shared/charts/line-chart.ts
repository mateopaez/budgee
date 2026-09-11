import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface LinePoint {
  readonly label: string;
  readonly value: number;
}

interface ChartCoord {
  readonly x: number;
  readonly y: number;
}

/**
 * Data-driven SVG area chart: smooth spend line, soft fill, optional average
 * series, and a dashed projection from the latest point to the end of the domain.
 */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <figure class="m-0">
      <div class="relative">
        <svg
          [attr.viewBox]="'0 0 ' + width + ' ' + height"
          preserveAspectRatio="none"
          class="block h-[9.5rem] w-full"
          role="img"
          [attr.aria-label]="ariaLabel()"
        >
          <defs>
            <linearGradient [attr.id]="gradientId()" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" [attr.stop-color]="color()" stop-opacity="0.5" />
              <stop offset="55%" [attr.stop-color]="color()" stop-opacity="0.14" />
              <stop offset="100%" [attr.stop-color]="color()" stop-opacity="0" />
            </linearGradient>
          </defs>

          @if (comparisonPath()) {
            <path
              [attr.d]="comparisonPath()"
              fill="none"
              stroke="var(--color-ink-faint)"
              stroke-opacity="0.35"
              stroke-width="1.5"
              stroke-dasharray="3 6"
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
              stroke-width="3.25"
              stroke-linecap="round"
              stroke-linejoin="round"
              vector-effect="non-scaling-stroke"
            />
          }

          @if (projectionPath()) {
            <path
              [attr.d]="projectionPath()"
              fill="none"
              stroke="var(--color-ink-faint)"
              stroke-width="1.75"
              stroke-dasharray="5 6"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          }
        </svg>

        @if (lastPoint(); as p) {
          <span
            class="pointer-events-none absolute size-[0.7rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
            [style.left.%]="p.xPercent"
            [style.top.%]="p.yPercent"
            [style.background]="color()"
            aria-hidden="true"
          ></span>
        }
      </div>

      <div class="relative mt-2 h-4 text-[0.72rem] text-ink-muted">
        @for (tick of ticks(); track tick.label + tick.xPercent) {
          <span class="absolute top-0" [style.left.%]="tick.xPercent" [style.transform]="tick.transform">
            {{ tick.label }}
          </span>
        }
      </div>
    </figure>
  `,
})
export class LineChart {
  readonly points = input.required<readonly LinePoint[]>();
  /** Optional dashed reference series (e.g. even pace / average), aligned to the domain. */
  readonly comparison = input<readonly number[]>([]);
  /**
   * Full X-axis length in samples. When larger than `points`, the spend line
   * stops early and a horizontal projection continues to the end.
   */
  readonly domainLength = input(0);
  readonly color = input('var(--color-accent)');
  readonly ariaLabel = input('Spending over time');
  readonly tickCount = input(6);

  protected readonly width = 300;
  protected readonly height = 120;
  private readonly paddingY = 8;
  private readonly paddingX = 2;

  private readonly instanceId = Math.random().toString(36).slice(2, 8);
  protected readonly gradientId = computed(() => `line-fill-${this.instanceId}`);

  private readonly resolvedDomain = computed(() =>
    Math.max(1, this.domainLength(), this.points().length, this.comparison().length),
  );

  private readonly maxValue = computed(() => {
    const values = [...this.points().map((p) => p.value), ...this.comparison()];
    // Leave headroom so the curve and end marker sit below the top edge.
    return Math.max(1, ...values) * 1.18;
  });

  private readonly coords = computed(() =>
    this.project(
      this.points().map((p) => p.value),
      this.resolvedDomain(),
    ),
  );

  private readonly comparisonCoords = computed(() =>
    this.project([...this.comparison()], this.resolvedDomain()),
  );

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
    const baseline = this.height - this.paddingY;
    return `${line} L ${last.x} ${baseline} L ${first.x} ${baseline} Z`;
  });

  protected readonly projectionPath = computed(() => {
    const last = this.coords().at(-1);
    if (!last) return '';
    const endX = this.width - this.paddingX;
    if (last.x >= endX - 1) return '';
    return `M ${last.x} ${last.y} L ${endX} ${last.y}`;
  });

  protected readonly lastPoint = computed(() => {
    const last = this.coords().at(-1);
    if (!last) return null;
    return {
      xPercent: (last.x / this.width) * 100,
      yPercent: (last.y / this.height) * 100,
    };
  });

  protected readonly ticks = computed(() => {
    const list = this.points();
    const domain = this.resolvedDomain();
    if (list.length === 0) return [];

    const count = Math.min(this.tickCount(), list.length);
    const step = Math.max(1, Math.floor((list.length - 1) / Math.max(1, count - 1)));
    const span = Math.max(1, domain - 1);
    const out: { label: string; xPercent: number; transform: string }[] = [];

    const pushTick = (index: number) => {
      const xPercent =
        ((this.paddingX + (index / span) * (this.width - this.paddingX * 2)) / this.width) * 100;
      const transform =
        xPercent <= 2 ? 'translateX(0)' : xPercent >= 98 ? 'translateX(-100%)' : 'translateX(-50%)';
      out.push({ label: list[index].label, xPercent, transform });
    };

    for (let i = 0; i < list.length; i += step) pushTick(i);

    const lastIndex = list.length - 1;
    if (out.length > 0 && out[out.length - 1].label !== list[lastIndex].label) {
      pushTick(lastIndex);
    }

    return out;
  });

  private project(values: readonly number[], domain: number): ChartCoord[] {
    if (values.length === 0) return [];
    const max = this.maxValue();
    const usableY = this.height - this.paddingY * 2;
    const usableX = this.width - this.paddingX * 2;
    const span = Math.max(1, domain - 1);
    return values.map((value, index) => ({
      x: this.paddingX + (index / span) * usableX,
      y: this.height - this.paddingY - (value / max) * usableY,
    }));
  }
}

/** Catmull-Rom to cubic bezier, which keeps the curve gentle without overshoot. */
function smoothPath(points: readonly ChartCoord[]): string {
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
