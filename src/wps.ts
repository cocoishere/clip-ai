import type { SavedRecord } from './domain';
// Phase 2: Implement through an authenticated backend; never ship AppSecret in extension.
export interface WpsAdapter {
    connect(): Promise<void>;
    listDatabases(): Promise<{
        id: string;
        name: string;
    }[]>;
    readFields(fileId: string, tableId: string): Promise<{
        id: string;
        name: string;
    }[]>;
    createTable(fileId: string, name: string): Promise<string>;
    createFields(fileId: string, tableId: string, fields: {
        name: string;
        type: string;
    }[]): Promise<void>;
    createRecords(fileId: string, tableId: string, records: SavedRecord[]): Promise<void>;
    updateRecords(fileId: string, tableId: string, records: SavedRecord[]): Promise<void>;
    checkDuplicates(fileId: string, ids: string[]): Promise<string[]>;
}
export const wpsIntegration = { available: false, delivery: 'CSV export only' } as const;
