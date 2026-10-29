import { TestBed } from '@angular/core/testing';
import { decodeDocument, emptyDocument, ItemValues, newItem } from '../../domain/worklog';
import { ItemForm } from './item-form';

describe('Hour-based time entry', () => {
  async function setup(minutes = 60) {
    const fixture = TestBed.createComponent(ItemForm);
    fixture.componentRef.setInput('item', {
      ...newItem('2026-10-26', 'MEETING'),
      timeSpent: minutes,
    });
    await fixture.whenStable();
    return fixture;
  }

  it('displays existing saved durations in hours and preserves them on save', async () => {
    for (const minutes of [60, 30, 1, 61]) {
      const fixture = await setup(minutes);
      expect(fixture.componentInstance.form.controls.timeSpent.value).toBe(minutes / 60);
      let saved: ItemValues | undefined;
      fixture.componentInstance.saved.subscribe((values) => {
        saved = values;
      });
      fixture.componentInstance.submit();
      expect(saved?.timeSpent).toBeCloseTo(minutes, 10);
      fixture.destroy();
    }
  });

  it('accepts fractional hours and persists the equivalent duration without rounding to minutes', async () => {
    const fixture = await setup();
    for (const hours of [0, 0.01, 0.5, 1.25, 1.5]) {
      let saved: ItemValues | undefined;
      const subscription = fixture.componentInstance.saved.subscribe((values) => {
        saved = values;
      });
      fixture.componentInstance.form.controls.timeSpent.setValue(hours);
      fixture.componentInstance.submit();
      expect(saved?.timeSpent).toBeCloseTo(hours * 60, 10);
      const document = emptyDocument('2026-10-26');
      document.items = [{ ...newItem('2026-10-26', 'MEETING'), timeSpent: hours * 60 }];
      const restored = decodeDocument(JSON.stringify(document)).items[0];
      if (!restored || restored.type === 'TODO') throw new Error('Expected timed worklog');
      expect(restored.timeSpent).toBeCloseTo(hours * 60, 10);
      subscription.unsubscribe();
    }
  });

  it('rejects negative, missing and nonfinite hours', async () => {
    const fixture = await setup();
    const save = vi.fn();
    fixture.componentInstance.saved.subscribe(save);
    for (const hours of [-1, NaN, Infinity]) {
      fixture.componentInstance.form.controls.timeSpent.setValue(hours);
      fixture.componentInstance.submit();
      expect(fixture.componentInstance.form.invalid).toBe(true);
    }
    const input: HTMLInputElement = fixture.nativeElement.querySelector('#hours');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.componentInstance.submit();
    expect(save).not.toHaveBeenCalled();
  });
});
