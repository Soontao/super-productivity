import { Injectable } from '@angular/core';
import { SyncProvider, SyncProviderServiceInterface } from '../sync-provider.model';
import { SyncGetRevResult } from '../sync.model';

import { Observable } from 'rxjs';
import { concatMap, distinctUntilChanged, first, map } from 'rxjs/operators';
import { AListApiService } from './alist-api.service';
import { DataInitService } from '../../../core/data-init/data-init.service';
import { WebDavConfig } from '../../../features/config/global-config.model';
import { GlobalConfigService } from '../../../features/config/global-config.service';
import { GlobalProgressBarService } from '../../../core-ui/global-progress-bar/global-progress-bar.service';
import { T } from '../../../t.const';
import { AListHeadResponse } from './alist.model';

@Injectable({ providedIn: 'root' })
export class AListSyncService implements SyncProviderServiceInterface {
  id: SyncProvider = SyncProvider.WebDAV;

  isReady$: Observable<boolean> = this._dataInitService.isAllDataLoadedInitially$.pipe(
    concatMap(() => this._aListApiService.isAllConfigDataAvailable$),
    distinctUntilChanged(),
  );

  private _cfg$: Observable<WebDavConfig> = this._globalConfigService.cfg$.pipe(
    map((cfg) => cfg?.sync.aList),
  );

  //
  constructor(
    private _aListApiService: AListApiService,
    private _dataInitService: DataInitService,
    private _globalConfigService: GlobalConfigService,
    private _globalProgressBarService: GlobalProgressBarService,
  ) {}

  async getRevAndLastClientUpdate(
    localRev: string,
  ): Promise<{ rev: string; clientUpdate: number } | SyncGetRevResult> {
    const cfg = await this._cfg$.pipe(first()).toPromise();

    try {
      const meta = await this._aListApiService.getMetaData(cfg.syncFilePath as string);
      // @ts-ignore
      const d = new Date(meta['last-modified']);
      return {
        clientUpdate: d.getTime(),
        rev: this._getRevFromMeta(meta),
      };
    } catch (e: unknown) {
      const isAxiosError = !!(e && (e as any).response && (e as any).response.status);
      if (
        (isAxiosError && (e as any).response.status === 404) ||
        (e as any).status === 404
      ) {
        return 'NO_REMOTE_DATA';
      }
      console.error(e);
      return e as Error;
    }
  }

  async downloadAppData(localRev: string): Promise<{ rev: string; dataStr: string }> {
    this._globalProgressBarService.countUp(T.GPB.WEB_DAV_DOWNLOAD);
    const cfg = await this._cfg$.pipe(first()).toPromise();
    try {
      const r = await this._aListApiService.download({
        path: cfg.syncFilePath as string,
        localRev,
      });
      const meta = await this._aListApiService.getMetaData(cfg.syncFilePath as string);
      this._globalProgressBarService.countDown();
      return {
        rev: this._getRevFromMeta(meta),
        dataStr: r,
      };
    } catch (e) {
      this._globalProgressBarService.countDown();
      // TODO fix error handling
      return e as any;
    }
  }

  async uploadAppData(
    dataStr: string,
    clientModified: number,
    localRev: string,
    isForceOverwrite: boolean = false,
  ): Promise<string | Error> {
    this._globalProgressBarService.countUp(T.GPB.WEB_DAV_UPLOAD);
    const cfg = await this._cfg$.pipe(first()).toPromise();
    try {
      await this._aListApiService.upload({
        path: cfg.syncFilePath as string,
        data: dataStr,
      });

      const meta = await this._aListApiService.getMetaData(cfg.syncFilePath as string);
      this._globalProgressBarService.countDown();
      return this._getRevFromMeta(meta);
    } catch (e) {
      console.error(e);
      this._globalProgressBarService.countDown();
      return e as Error;
    }
  }

  private _getRevFromMeta(meta: AListHeadResponse): string {
    if (typeof meta?.etag !== 'string') {
      console.warn('No etag for WebDAV');
    }
    const rev = meta.etag || meta['oc-etag'] || meta['last-modified'];
    if (!rev) {
      throw new Error('Not able to get rev for WebDAV');
    }
    return rev;
  }
}
