export type ServiceTarget = {
  externalId: string;
  ipAddress?: string;
  macAddress?: string;
};

export type SpeedProfile = {
  downloadKbps: number;
  uploadKbps: number;
  burstDownloadKbps?: number;
  burstUploadKbps?: number;
};

export interface NetworkProvider {
  testConnection(): Promise<void>;
  applySpeed(target: ServiceTarget, profile: SpeedProfile): Promise<void>;
  suspend(target: ServiceTarget): Promise<void>;
  activate(target: ServiceTarget): Promise<void>;
}
