import { drive_v3 } from 'googleapis';
import { IStorageProvider } from '../IStorageProvider';
import { Document, CreateDocumentRequest, GoogleDriveConfig, ProviderError } from '../../src/types';
import { GoogleAuthHelper } from './auth';
import { DocumentOperations } from './operations';
import { PermissionsManager } from './permissions';
import { MetadataManager } from './metadata';
import { FolderManager } from './folders';

/**
 * Google Drive Storage Provider
 *
 * Implements IStorageProvider for Google Drive.
 * Orchestrates all helper modules to provide complete document management.
 */
export class GoogleDriveProvider implements IStorageProvider {
  private authHelper: GoogleAuthHelper;
  private operations: DocumentOperations;
  private permissions: PermissionsManager;
  private metadata: MetadataManager;
  private folders: FolderManager;
  private config: GoogleDriveConfig;

  constructor(config: GoogleDriveConfig) {
    this.config = config;
    this.authHelper = new GoogleAuthHelper(config);
    this.operations = new DocumentOperations(this.authHelper);
    this.permissions = new PermissionsManager(this.authHelper);
    this.metadata = new MetadataManager(this.authHelper);
    this.folders = new FolderManager(this.authHelper);
  }

  // ==================== DOCUMENT OPERATIONS ====================

  async copyDocument(request: CreateDocumentRequest): Promise<Document> {
    try {
      // 1. Create folder
      let folderId: string | undefined;
      if (request.folder_path) {
        folderId = await this.folders.createPath(request.folder_path);
      }
  
      // 2. Copy document
      const copiedFile = await this.operations.copyDocument(
        request.source_reference,
        request.source_owner,
        request.name,
        folderId
      );
  
      // 3. Set permissions
      if (request.access_control && request.access_control.length > 0) {
        await this.permissions.setPermissions(copiedFile.id!, request.access_control);
      }
  
      // 4. Transform to Document
      return this.transformToDocument(copiedFile);
    } catch (error: any) {
      throw new ProviderError(`Failed to create document: ${error.message}`, error);
    }
  }
  


  // ==================== HELPER METHODS ====================

  /**
   * Transform Google Drive file to Document format
   */
  private transformToDocument(file: drive_v3.Schema$File): Document {
    return {
      document_id: file.id!,
      provider: 'google_drive',
      storage_reference: file.id!,
      name: file.name || 'Untitled',
      access_url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
      created_at: file.createdTime || new Date().toISOString(),
      updated_at: file.modifiedTime,
    };
  }
}
