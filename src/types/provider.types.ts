/**
 * Supported storage provider types
 */
export enum ProviderType {
  GOOGLE_DRIVE = 'google_drive',
  S3 = 's3'
}

/**
 * Google Drive provider configuration
 */
export interface GoogleDriveConfig {
    serviceAccountKey: ServiceAccountKey;  // Always an object
    adminEmail: string; // The admin account that owns all documents
  }
  
  /**
   * Service account key structure (from Google Cloud)
   */
  export interface ServiceAccountKey {
    type: string;
    project_id: string;
    private_key_id: string;
    private_key: string;
    client_email: string;
    client_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_x509_cert_url: string;
  }
  
  /**
   * S3 provider configuration (future)
   */
  export interface S3Config {
    region: string;
    bucket: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  }
  
  /**
   * Union type for all provider configs
   */
  export type ProviderConfig = GoogleDriveConfig | S3Config;