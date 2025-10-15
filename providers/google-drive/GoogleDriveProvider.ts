import { drive_v3 } from 'googleapis';
import { IStorageProvider } from '../IStorageProvider';
import { Document, CreateDocumentRequest, GoogleDriveConfig, ProviderError } from '../../src/types';
import { GoogleAuthHelper } from './auth';
import { DocumentOperations } from './operations';
import { PermissionsManager } from './permissions';
import { MetadataManager } from './metadata';
import { FolderManager } from './folders';

/**
 * Google Drive Storage Provider implementation.
 *
 * Implements the {@link IStorageProvider} interface for Google Drive.
 * Orchestrates all helper modules (auth, operations, permissions, metadata, folders)
 * to provide complete document management functionality.
 */
export class GoogleDriveProvider implements IStorageProvider {
  /**
   * Helper for Google authentication and impersonation.
   */
  private authHelper: GoogleAuthHelper;

  /**
   * Handles document-level operations (copy, move, etc.).
   */
  private operations: DocumentOperations;

  /**
   * Manages permissions for Google Drive files.
   */
  private permissions: PermissionsManager;

  /**
   * Handles custom metadata for documents.
   */
  private metadata: MetadataManager;

  /**
   * Manages folder creation and navigation.
   */
  private folders: FolderManager;

  /**
   * Provider-specific configuration.
   */
  private config: GoogleDriveConfig;

  /**
   * Constructs a new GoogleDriveProvider instance.
   * @param config The configuration object for Google Drive integration.
   */
  constructor(config: GoogleDriveConfig) {
    this.config = config;
    this.authHelper = new GoogleAuthHelper(config);
    this.operations = new DocumentOperations(this.authHelper);
    this.permissions = new PermissionsManager(this.authHelper);
    this.metadata = new MetadataManager(this.authHelper);
    this.folders = new FolderManager(this.authHelper);
  }

  // ==================== DOCUMENT OPERATIONS ====================

  /**
   * Copies a document in Google Drive according to the request details.
   *
   * Steps:
   * 1. Creates the target folder structure if `folder_path` is provided.
   * 2. Copies the source document, impersonating the source owner.
   * 3. Sets permissions if `access_control` is specified.
   * 4. Transforms the copied file into the Document format.
   *
   * @param request The document creation request, including source reference, owner, name, folder path, and access control.
   * @returns The created Document object.
   * @throws {ProviderError} If any step fails during the process.
   */
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
   * Converts a Google Drive file object to the internal Document format.
   *
   * @param file The Google Drive file to convert.
   * @returns The corresponding Document object.
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
