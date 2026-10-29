import { TestBed } from '@angular/core/testing';
import { DIALOG_DATA, Dialog, DialogRef } from '@angular/cdk/dialog';
import { Subject, of } from 'rxjs';
import { DayDialog } from './day-dialog';
import { Toast } from '../../../../core/notifications/toast';
import { WORKLOG_REPOSITORY } from '../../data-access/worklog-repository';
import {
  emptyDocument,
  localDate,
  newItem,
  newTodo,
  reconcile,
  WorklogDocument,
} from '../../domain/worklog';

describe('Day dialog bulk deletion', () => {
  let saved: WorklogDocument;
  let fail: boolean;
  let answer: boolean;
  const confirm = vi.fn(() => ({ closed: of(answer) }));
  const success = vi.fn();
  const ref = {
    keydownEvents: new Subject<KeyboardEvent>(),
    backdropClick: new Subject<void>(),
    closed: new Subject<void>(),
    close: vi.fn(),
  };
  beforeEach(() => {
    const today = localDate();
    saved = reconcile(emptyDocument(today), today);
    saved = {
      ...saved,
      items: [
        newItem(today, 'MEETING'),
        { ...newItem(today, 'MEETING'), timeLog: true },
        newItem(today, 'WORK_ON_TASK'),
        newItem('2020-01-01', 'MEETING'),
      ],
    };
    fail = false;
    answer = true;
    confirm.mockClear();
    success.mockClear();
    TestBed.configureTestingModule({
      imports: [DayDialog],
      providers: [
        { provide: DIALOG_DATA, useValue: { date: today, itemId: saved.items[0].id } },
        { provide: DialogRef, useValue: ref },
        { provide: Toast, useValue: { success } },
        {
          provide: WORKLOG_REPOSITORY,
          useValue: {
            read: () => saved,
            write: (document: WorklogDocument) => {
              if (fail) throw new Error('Storage full');
              saved = document;
              return saved;
            },
          },
        },
      ],
    });
    TestBed.overrideProvider(Dialog, { useValue: { open: confirm } });
  });
  afterEach(() => {
    ref.closed.next();
    TestBed.resetTestingModule();
  });
  it('saves on Enter, focuses a new title, and blocks creation on invalid or failed saves', async () => {
    const fixture = TestBed.createComponent(DayDialog);
    const page = fixture.componentInstance;
    page.selectTab('todo');
    page.addTodo();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const title = element.querySelector<HTMLInputElement>('.title');
    if (!title) throw new Error('Missing TODO title');
    expect(document.activeElement).toBe(title);
    title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    expect(page.todoRows()).toHaveLength(1);
    expect(page.todoErrors()[page.todoRows()[0].id]).toBe('Enter a TODO title.');
    title.value = 'First reminder';
    title.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    fail = true;
    title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    expect(page.todoRows()).toHaveLength(1);
    expect(title.value).toBe('First reminder');
    expect(page.todos()).toHaveLength(0);
    fail = false;
    title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await fixture.whenStable();
    expect(page.todos()[0].title).toBe('First reminder');
    expect(page.todoRows()).toHaveLength(2);
    const titles = element.querySelectorAll<HTMLInputElement>('.title');
    expect(titles[1].value).toBe('');
    expect(document.activeElement).toBe(titles[1]);
  });
  it('offers independent checkboxes, select all, partial selection and disabled empty deletion', () => {
    const fixture = TestBed.createComponent(DayDialog);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const inputs = element.querySelectorAll<HTMLInputElement>('aside input[type=checkbox]');
    expect(inputs).toHaveLength(4);
    const all = element.querySelector<HTMLInputElement>('.select-all input');
    const first = element.querySelector<HTMLInputElement>('.item-row input');
    const remove = element.querySelector<HTMLButtonElement>('.bulk-delete');
    expect(remove?.disabled).toBe(true);
    const editor = fixture.componentInstance.selected();
    first?.click();
    fixture.detectChanges();
    expect(all?.indeterminate).toBe(true);
    expect(remove?.disabled).toBe(false);
    expect(fixture.componentInstance.selected()).toBe(editor);
    all?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.checkedItems()).toHaveLength(3);
    all?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.checkedItems()).toHaveLength(0);
  });
  it('switches accessible tabs with keyboard and autosaves worklog input', async () => {
    const fixture = TestBed.createComponent(DayDialog);
    const page = fixture.componentInstance;
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const input = element.querySelector<HTMLInputElement>('#hours');
    if (!input) throw new Error('Missing worklog input');
    input.value = '2.5';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const tabs = element.querySelectorAll<HTMLButtonElement>('[role=tab]');
    tabs[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    expect(page.tab()).toBe('todo');
    expect(element.querySelector<HTMLElement>('#worklog-panel')?.hidden).toBe(true);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(page.dirty()).toBe(false);
    expect(saved.items.find((item) => item.id === page.selected()?.id)).toMatchObject({
      timeSpent: 150,
    });
    tabs[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();
    expect(page.tab()).toBe('worklog');
    expect(input.value).toBe('2.5');
    expect(element.querySelector<HTMLElement>('#todo-panel')?.hidden).toBe(true);
  });
  it('autosaves on leaving the worklog form but not between its fields or on unchanged blur', async () => {
    const fixture = TestBed.createComponent(DayDialog);
    const page = fixture.componentInstance;
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const hours = element.querySelector<HTMLInputElement>('#hours');
    const logged = element.querySelector<HTMLInputElement>('app-item-form input[type=checkbox]');
    if (!hours || !logged) throw new Error('Missing worklog fields');
    const write = vi.spyOn(TestBed.inject(WORKLOG_REPOSITORY), 'write');
    hours.value = '1.5';
    hours.dispatchEvent(new Event('input', { bubbles: true }));
    hours.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: logged }));
    expect(write).not.toHaveBeenCalled();
    hours.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await fixture.whenStable();
    expect(write).toHaveBeenCalledTimes(1);
    expect(saved.items.find((item) => item.id === page.selected()?.id)).toMatchObject({
      timeSpent: 90,
    });
    expect(page.dirty()).toBe(false);
    hours.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    expect(write).toHaveBeenCalledTimes(1);
    expect(element.querySelector('button[type=submit]')?.textContent).toContain('Save item');
  });
  it('autosaves valid work when clicking the backdrop and keeps the manual Save button working', async () => {
    const fixture = TestBed.createComponent(DayDialog);
    const page = fixture.componentInstance;
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const hours = element.querySelector<HTMLInputElement>('#hours');
    const submit = element.querySelector<HTMLButtonElement>('app-item-form button[type=submit]');
    if (!hours || !submit) throw new Error('Missing form controls');
    const write = vi.spyOn(TestBed.inject(WORKLOG_REPOSITORY), 'write');
    hours.value = '2';
    hours.dispatchEvent(new Event('input', { bubbles: true }));
    hours.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: submit }));
    expect(write).not.toHaveBeenCalled();
    submit.click();
    await fixture.whenStable();
    expect(write).toHaveBeenCalledTimes(1);
    hours.value = '3';
    hours.dispatchEvent(new Event('input', { bubbles: true }));
    ref.close.mockClear();
    ref.backdropClick.next();
    await fixture.whenStable();
    expect(write).toHaveBeenCalledTimes(2);
    expect(saved.items.find((item) => item.id === page.selected()?.id)).toMatchObject({
      timeSpent: 180,
    });
    expect(ref.close).toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
  it('retains invalid, failed and stale autosave input for retry and protects dialog close', async () => {
    const fixture = TestBed.createComponent(DayDialog);
    const page = fixture.componentInstance;
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const hours = element.querySelector<HTMLInputElement>('#hours');
    if (!hours) throw new Error('Missing hours input');
    const before = saved;
    hours.value = '-1';
    hours.dispatchEvent(new Event('input', { bubbles: true }));
    hours.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await fixture.whenStable();
    expect(saved).toBe(before);
    expect(page.dirty()).toBe(true);
    expect(element.querySelector('#hours-error')).not.toBeNull();
    hours.value = '4';
    hours.dispatchEvent(new Event('input', { bubbles: true }));
    fail = true;
    hours.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await fixture.whenStable();
    expect(saved).toBe(before);
    expect(hours.value).toBe('4');
    expect(page.dirty()).toBe(true);
    expect(success).not.toHaveBeenCalled();
    expect(page.store.error()).toContain('Storage full');
    answer = false;
    ref.close.mockClear();
    await page.close();
    expect(ref.close).not.toHaveBeenCalled();
    fail = false;
    const write = vi
      .spyOn(TestBed.inject(WORKLOG_REPOSITORY), 'write')
      .mockImplementationOnce(() => {
        throw new Error('Stale revision');
      });
    hours.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await fixture.whenStable();
    expect(page.store.error()).toContain('Stale revision');
    expect(hours.value).toBe('4');
    write.mockRestore();
    hours.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await fixture.whenStable();
    expect(saved.items.find((item) => item.id === page.selected()?.id)).toMatchObject({
      timeSpent: 240,
    });
    expect(page.dirty()).toBe(false);
  });
  it('keeps Cancel and Delete from autosaving pending changes', async () => {
    const fixture = TestBed.createComponent(DayDialog);
    const page = fixture.componentInstance;
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const hours = element.querySelector<HTMLInputElement>('#hours');
    const cancel = element.querySelector<HTMLButtonElement>('app-item-form button[type=button]');
    const remove = element.querySelector<HTMLButtonElement>('.form-heading button');
    if (!hours || !cancel || !remove) throw new Error('Missing controls');
    hours.value = '5';
    hours.dispatchEvent(new Event('input', { bubbles: true }));
    const before = saved;
    answer = false;
    hours.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: cancel }));
    cancel.click();
    await fixture.whenStable();
    expect(saved).toBe(before);
    expect(page.dirty()).toBe(true);
    hours.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: remove }));
    remove.click();
    await fixture.whenStable();
    expect(saved).toBe(before);
    expect(page.dirty()).toBe(true);
    expect(success).not.toHaveBeenCalled();
  });
  it('saves inline drafts on leaving the row, retains failed text and protects close', async () => {
    const fixture = TestBed.createComponent(DayDialog);
    const page = fixture.componentInstance;
    page.selectTab('todo');
    page.addTodo();
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const title = element.querySelector<HTMLInputElement>('app-todo-checklist .title');
    if (!title) throw new Error('Missing TODO fields');
    title.value = 'Pending reminder';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    fail = true;
    title.dispatchEvent(
      new FocusEvent('focusout', {
        bubbles: true,
        relatedTarget: element.querySelector('#worklog-tab'),
      }),
    );
    await fixture.whenStable();
    expect(title.value).toBe('Pending reminder');
    expect(page.todoDrafts().size).toBe(1);
    expect(page.todos()).toEqual([]);
    expect(element.querySelector('app-todo-checklist [role=alert]')?.textContent).toContain(
      'Storage full',
    );
    expect(success).not.toHaveBeenCalled();
    page.selectTab('worklog');
    page.selectTab('todo');
    await fixture.whenStable();
    expect(title.value).toBe('Pending reminder');
    answer = false;
    ref.close.mockClear();
    await page.close();
    expect(ref.close).not.toHaveBeenCalled();
    fail = false;
    title.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    await fixture.whenStable();
    expect(page.todos()[0].title).toBe('Pending reminder');
    expect(page.todoDrafts().size).toBe(0);
    expect(page.todoErrors()).toEqual({});
  });
  it('validates blank titles, retries and supports saving a new item via its checkbox', async () => {
    const fixture = TestBed.createComponent(DayDialog);
    const page = fixture.componentInstance;
    page.selectTab('todo');
    page.addTodo();
    const draft = page.todoRows()[0];
    page.saveTodo(draft);
    expect(page.todoErrors()[draft.id]).toBe('Enter a TODO title.');
    expect(page.todos()).toHaveLength(0);
    page.editTodo({ item: draft, values: { title: 'Ready' } });
    page.toggleTodo(draft.id);
    expect(page.todos()[0]).toMatchObject({ title: 'Ready', completed: true });
    expect(page.todoDrafts().size).toBe(0);
    page.addTodo();
    await page.removeTodo(page.todoRows()[1]);
    expect(page.todoRows()).toHaveLength(1);
  });
  it('restores failed checkboxes and retains inline drafts through deletion cancellation and failure', async () => {
    saved.items.push({ ...newTodo(localDate()), title: 'Reminder' });
    const fixture = TestBed.createComponent(DayDialog);
    const page = fixture.componentInstance;
    page.selectTab('todo');
    await fixture.whenStable();
    const checkbox: HTMLInputElement = fixture.nativeElement.querySelector(
      'app-todo-checklist input[type=checkbox]',
    );
    fail = true;
    checkbox.click();
    await fixture.whenStable();
    expect(checkbox.checked).toBe(false);
    fail = false;
    checkbox.click();
    await fixture.whenStable();
    expect(checkbox.checked).toBe(true);
    const item = page.todoRows()[0];
    page.editTodo({ item, values: { title: 'Pending edit' } });
    answer = false;
    await page.removeTodo(item);
    expect(page.todoDrafts().size).toBe(1);
    expect(page.todos()).toHaveLength(1);
    answer = true;
    fail = true;
    await page.removeTodo(item);
    expect(page.todoDrafts().size).toBe(1);
    expect(page.todos()).toHaveLength(1);
    fail = false;
    await page.removeTodo(item);
    expect(page.todoRows()).toEqual([]);
    expect(page.todoDrafts().size).toBe(0);
  });
  it('retains selection and dirty edits on cancellation and failure; clears them only after success', async () => {
    const page = TestBed.createComponent(DayDialog).componentInstance;
    page.toggleAll();
    page.dirty.set(true);
    const before = page.selected();
    answer = false;
    await page.removeChecked();
    expect(page.items()).toHaveLength(3);
    expect(page.selected()).toBe(before);
    expect(page.dirty()).toBe(true);
    expect(page.checkedItems()).toHaveLength(3);
    answer = true;
    fail = true;
    await page.removeChecked();
    expect(page.items()).toHaveLength(3);
    expect(page.checkedItems()).toHaveLength(3);
    expect(page.selected()).toBe(before);
    expect(success).not.toHaveBeenCalled();
    expect(page.store.error()).toContain('Storage full');
    fail = false;
    await page.removeChecked();
    expect(page.items()).toEqual([]);
    expect(page.checkedItems()).toEqual([]);
    expect(page.selected()).toBeNull();
    expect(page.dirty()).toBe(false);
    expect(saved.items).toHaveLength(1);
    expect(saved.items[0].date).toBe('2020-01-01');
    expect(success).toHaveBeenCalledWith('3 work items deleted.');
    expect(confirm).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: expect.objectContaining({ message: expect.stringContaining('Unsaved changes') }),
      }),
    );
  });
  it('keeps an unselected dirty editor intact when deleting other items', async () => {
    const page = TestBed.createComponent(DayDialog).componentInstance;
    const current = page.selected();
    page.dirty.set(true);
    const other = page.items().find((item) => item.id !== current?.id);
    if (!other) throw new Error('Missing other item');
    page.toggleChecked(other.id);
    await page.removeChecked();
    expect(page.selected()).toBe(current);
    expect(page.dirty()).toBe(true);
    expect(page.items()).toHaveLength(2);
  });
});
