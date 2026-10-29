import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { formatHours, itemTitle, LoggedWorkItem } from '../../domain/worklog';
@Component({
  selector: 'app-work-item-card',
  templateUrl: './work-item-card.html',
  styleUrl: './work-item-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkItemCard {
  readonly item = input.required<LoggedWorkItem>();
  readonly choose = output<string>();
  readonly title = computed(() => {
    const item = this.item();
    const storyId = item.type === 'WORK_ON_TASK' ? item.storyId.trim() : '';
    return storyId ? `${storyId} · ${itemTitle(item)}` : itemTitle(item);
  });
  readonly hours = computed(() => formatHours(this.item().timeSpent));
  readonly status = computed(() => {
    const item = this.item();
    return item.type === 'WORK_ON_TASK'
      ? { TODO: 'To do', IN_PROGRESS: 'In progress', DONE: 'Done' }[item.status]
      : 'Meeting';
  });
}
