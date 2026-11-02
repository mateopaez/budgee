import { Directive, ElementRef, inject } from '@angular/core';

/**
 * Selects the whole value when an input gains focus, so typing replaces it.
 *
 * Calling `select()` from the focus handler alone is not enough. On a click or
 * tap, focus fires on pointer down and the browser then places the caret where
 * the pointer was released, which collapses the selection. The first mouseup
 * after focus is cancelled, and touch browsers get a second select on the next
 * task, after their own caret placement.
 */
@Directive({
  selector: 'input[appSelectOnFocus]',
  host: {
    '(focus)': 'onFocus()',
    '(mouseup)': 'onMouseUp($event)',
    '(keydown)': 'keepSelection = false',
    '(blur)': 'keepSelection = false',
  },
})
export class SelectOnFocus {
  private readonly input = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  protected keepSelection = false;

  protected onFocus(): void {
    this.keepSelection = true;
    this.input.select();
    setTimeout(() => {
      if (this.keepSelection && this.input.ownerDocument.activeElement === this.input) {
        this.input.setSelectionRange(0, this.input.value.length);
      }
    });
  }

  protected onMouseUp(event: MouseEvent): void {
    if (!this.keepSelection) return;
    this.keepSelection = false;
    event.preventDefault();
  }
}
