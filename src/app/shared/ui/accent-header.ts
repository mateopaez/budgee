import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Full bleed gradient header used by Overview and Budget. The rounded content
 * below overlaps it slightly, which is what gives the app its layered look.
 */
@Component({
  selector: 'app-accent-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <header
      class="relative px-4 pb-8"
      style="background: var(--accent-gradient); padding-top: calc(var(--safe-top) + 0.75rem)"
    >
      <div class="flex min-h-[3rem] items-center gap-2">
        <div class="flex size-11 items-center justify-center">
          <ng-content select="[headerLeading]" />
        </div>
        <div class="min-w-0 flex-1 text-center">
          <ng-content select="[headerTitle]" />
        </div>
        <div class="flex size-11 items-center justify-center">
          <ng-content select="[headerTrailing]" />
        </div>
      </div>
      <div class="mt-3">
        <ng-content />
      </div>
    </header>
    @if (curved()) {
      <div class="-mt-4 h-4 rounded-t-[1.75rem] bg-canvas"></div>
    }
  `,
})
export class AccentHeader {
  readonly curved = input(true);
}
