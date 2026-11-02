import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SelectOnFocus } from './select-on-focus';

@Component({
  imports: [SelectOnFocus],
  template: `<input appSelectOnFocus value="12.40" />`,
})
class Host {}

describe('SelectOnFocus', () => {
  it('never cancels a keypress', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');

    input.dispatchEvent(new FocusEvent('focus'));
    const key = new KeyboardEvent('keydown', { key: '7', cancelable: true });
    input.dispatchEvent(key);

    expect(key.defaultPrevented).toBe(false);
  });
});
