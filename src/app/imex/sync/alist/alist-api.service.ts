import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { GlobalConfigService } from '../../../features/config/global-config.service';
import { DataInitService } from '../../../core/data-init/data-init.service';
import { first, map, switchMap, tap } from 'rxjs/operators';
// @ts-ignore
import { createClient } from 'webdav/web';
import { AListHeadResponse } from './alist.model';

@Injectable({ providedIn: 'root' })
export class AListApiService {
  private _cfg$: Observable<{
    baseUrl: string;
    userName: string;
    password: string;
    syncFilePath: string;
  }> = this._globalConfigService.cfg$.pipe(
    map(
      (cfg) =>
        cfg?.sync.aList as {
          baseUrl: string;
          userName: string;
          password: string;
          syncFilePath: string;
        },
    ),
  );

  isAllConfigDataAvailable$: Observable<boolean> = this._cfg$.pipe(
    map(
      (cfg) => !!(cfg && cfg.userName && cfg.baseUrl && cfg.syncFilePath && cfg.password),
    ),
  );

  private _isReady$: Observable<boolean> =
    this._dataInitService.isAllDataLoadedInitially$.pipe(
      switchMap(() => this.isAllConfigDataAvailable$),
      tap((isTokenAvailable) => !isTokenAvailable && new Error('WebDAV API not ready')),
      first(),
    );

  constructor(
    private _globalConfigService: GlobalConfigService,
    private _dataInitService: DataInitService,
  ) { }

  async upload({ data, path }: { data: string; path: string }): Promise<void> {
    await this._isReady$.toPromise();
    const cfg = await this._cfg$.pipe(first()).toPromise();
    const client = createClient(cfg.baseUrl, {
      username: cfg.userName,
      password: cfg.password,
    });

    return await client.putFileContents(path, JSON.stringify(data), {
      contentLength: false,
    });
  }

  async getMetaData(path: string): Promise<AListHeadResponse> {
    await this._isReady$.toPromise();
    const cfg = await this._cfg$.pipe(first()).toPromise();
    const client = createClient(cfg.baseUrl, {
      username: cfg.userName,
      password: cfg.password,
    });
    const r = await client.getFileContents(path + '.rev', { format: 'text' });
    return r as any;
  }

  async download({
    path,
    localRev,
  }: {
    path: string;
    localRev?: string | null;
  }): Promise<string> {
    await this._isReady$.toPromise();
    const cfg = await this._cfg$.pipe(first()).toPromise();
    const client = createClient(cfg.baseUrl, {
      username: cfg.userName,
      password: cfg.password,
    });
    const r = await client.getFileContents(path, { format: 'text' });
    return r as any;
  }
}
