import { GoogleDriveProvider } from '../providers/google-drive/GoogleDriveProvider';
import {
  Document,
  CreateDocumentRequest,
  GoogleDriveConfig,
  ValidationError,
} from './types';

import { IStorageProvider } from '../providers/IStorageProvider';

/**
 * Document Manager Configuration
 */
interface DocumentManagerConfig {
  provider: 'google_drive' | 's3';
  config: GoogleDriveConfig; // Will be union type when S3 added
}

/**
 * Document Manager
 * 
 * Main facade class that provides a unified interface for document operations.
 * Automatically creates the appropriate provider based on configuration.
 */
export class DocumentManager {
  private provider: IStorageProvider;

  constructor(options: DocumentManagerConfig) {
    // Create provider based on type
    if (options.provider === 'google_drive') {
      this.provider = new GoogleDriveProvider(options.config);
    } else if (options.provider === 's3') {
      throw new Error('S3 provider not yet implemented');
    } else {
      throw new ValidationError(`Unsupported provider: ${options.provider}`);
    }
  }

  /**
   * Create new document from source
   */
  async createDocument(request: CreateDocumentRequest): Promise<Document> {
    // validateCreateRequest(request);
    return await this.provider.copyDocument(request);
  }


}