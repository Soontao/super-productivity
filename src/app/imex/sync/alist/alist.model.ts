// TODO throws compile error :(
// import { FileStat } from 'webdav/web/types';
import { IncomingHttpHeaders } from 'http';

export interface FileStat {
  filename: string;
  basename: string;
  lastmod: string;
  size: number;
  type: 'file' | 'directory';
  etag: string | null;
  mime?: string;
  props?: unknown;
}

export interface AListHeadResponse extends IncomingHttpHeaders {
  'oc-etag'?: string;
}
