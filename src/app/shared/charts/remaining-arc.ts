import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface RemainingArcSegment {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly amountLabel: string;
}

interface RenderedArc {
  readonly id: string;
  readonly d: string;
  readonly opacity: number;
}

interface RenderedLabel {
  readonly id: string;
  readonly amountLabel: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly anchor: 'start' | 'middle' | 'end';
}

/**
 * Open horseshoe gauge for Budget → Remaining.
 * White segments = spending used (by group); the dim trailing arc = left to spend.
 */
@Component({
  selector: 'app-remaining-arc',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block overflow-visible' },
  template: `
    <div class="relative mx-auto overflow-visible" [style.width.px]="size()" [style.height.px]="size()">
      <svg
        [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
        class="size-full overflow-visible"
        role="img"
        [attr.aria-label]="ariaLabel()"
      >
        @for (segment of arcs(); track segment.id) {
          <path
            [attr.d]="segment.d"
            fill="none"
            stroke="var(--color-ink)"
            [attr.stroke-width]="thickness()"
            [attr.stroke-opacity]="segment.opacity"
            stroke-linecap="round"
          />
        }
        @for (item of labels(); track item.id) {
          <text
            [attr.x]="item.x"
            [attr.y]="item.y"
            [attr.text-anchor]="item.anchor"
            fill="var(--color-ink)"
            style="font-size: 10px; font-weight: 600"
          >
            <tspan [attr.x]="item.x" dy="0">{{ item.amountLabel }}</tspan>
            <tspan
              [attr.x]="item.x"
              dy="12"
              fill="var(--color-ink-muted)"
              style="font-size: 9px; font-weight: 500"
            >
              {{ item.label }}
            </tspan>
          </text>
        }
      </svg>
      <div
        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
        [style.padding-bottom.px]="size() * 0.06"
      >
        <ng-content />
      </div>
    </div>
  `,
})
export class RemainingArc {
  readonly segments = input.required<readonly RemainingArcSegment[]>();
  /** Unspent budget left; drawn as the dim trailing portion of the arc. */
  readonly remainingCents = input(0);
  readonly size = input(300);
  readonly thickness = input(18);
  readonly ariaLabel = input('Budget used versus left to spend');

  /** Bottom opening, as a fraction of a full turn (≈ 5 o'clock → 7 o'clock). */
  private readonly openingRatio = 0.22;
  private readonly gapRatio = 0.014;
  private readonly labelPad = 64;

  protected readonly arcs = computed(() => this.layout().arcs);
  protected readonly labels = computed(() => this.layout().labels);

  private readonly layout = computed(() => {
    const spent = this.segments().filter((s) => s.value > 0);
    const remaining = Math.max(0, this.remainingCents());
    const spentTotal = spent.reduce((sum, s) => sum + s.value, 0);
    const capacity = spentTotal + remaining;
    if (capacity <= 0) return { arcs: [] as RenderedArc[], labels: [] as RenderedLabel[] };

    const size = this.size();
    const cx = size / 2;
    const cy = size / 2;
    const thickness = this.thickness();
    const r = size / 2 - this.labelPad - thickness / 2;
    const opening = this.openingRatio * Math.PI * 2;
    const sweep = Math.PI * 2 - opening;
    const startAngle = Math.PI / 2 + opening / 2;
    const gapAngle = spent.length + (remaining > 0 ? 1 : 0) > 1 ? this.gapRatio * sweep : 0;
    const capAngle = thickness / 2 / r;
    const edge = 8;

    let cursor = startAngle;
    const arcs: RenderedArc[] = [];
    const labels: RenderedLabel[] = [];

    const pushArc = (
      id: string,
      share: number,
      opacity: number,
      label: RemainingArcSegment | null,
    ): void => {
      const visualSpan = Math.max(0, share - gapAngle);
      const pathStart = cursor + (visualSpan > capAngle * 2 ? capAngle : 0);
      const pathEnd = cursor + visualSpan - (visualSpan > capAngle * 2 ? capAngle : 0);
      const mid = cursor + visualSpan / 2;
      cursor += share;

      if (pathEnd - pathStart > 0.001) {
        arcs.push({ id, d: arcPath(cx, cy, r, pathStart, pathEnd), opacity });
      }

      if (!label) return;

      const labelR = r + thickness / 2 + 14;
      let lx = cx + labelR * Math.cos(mid);
      let ly = cy + labelR * Math.sin(mid);
      const side = Math.cos(mid);
      const anchor: 'start' | 'middle' | 'end' =
        side > 0.25 ? 'start' : side < -0.25 ? 'end' : 'middle';

      // Keep labels inside the viewBox so they are not clipped by the card.
      if (anchor === 'start') lx = Math.min(lx, size - edge);
      else if (anchor === 'end') lx = Math.max(lx, edge);
      else lx = Math.min(size - edge, Math.max(edge, lx));
      ly = Math.min(size - 18, Math.max(14, ly));

      labels.push({
        id: label.id,
        amountLabel: label.amountLabel,
        label: shortenLabel(label.label),
        x: lx,
        y: ly - 4,
        anchor,
      });
    };

    for (const segment of spent) {
      pushArc(segment.id, (segment.value / capacity) * sweep, 1, segment);
    }
    if (remaining > 0) {
      pushArc('__remaining__', (remaining / capacity) * sweep, 0.22, null);
    }

    return { arcs, labels };
  });
}

function shortenLabel(label: string): string {
  if (label.length <= 12) return label;
  if (label === 'Other expenses') return 'Other';
  return `${label.slice(0, 11)}…`;
}

function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}
