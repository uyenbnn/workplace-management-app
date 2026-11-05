import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { WorklogStore } from '../../data-access/worklog-store';
@Component({
  selector: 'app-local-migration',
  templateUrl: './local-migration.html',
  styleUrl: './local-migration.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LocalMigration {
  readonly store = inject(WorklogStore);
  readonly migration = this.store.migration;
}
