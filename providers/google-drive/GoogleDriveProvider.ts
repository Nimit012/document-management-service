import { drive_v3 } from 'googleapis';
import { IStorageProvider } from '../IStorageProvider';
import { Document, CreateDocumentRequest, GoogleDriveConfig, ProviderError } from '../../src/types';
import { GoogleAuthHelper } from './auth';
import { DocumentOperations } from './operations';

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
   * Handles document-level operations (copy, move, permissions, folders, etc.).
   */
  private operations: DocumentOperations;

  /**
   * Constructs a new GoogleDriveProvider instance.
   * @param config The configuration object for Google Drive integration.
   */
  constructor(config: GoogleDriveConfig) {
    this.authHelper = new GoogleAuthHelper(config);
    this.operations = new DocumentOperations(this.authHelper);
  }

  // ==================== DOCUMENT OPERATIONS ====================

  /**
   * Copies a document in Google Drive according to the request details.
   *
   * Steps:
   * 1. Copies the source document, impersonating the source owner.
   * 2. Transfers ownership to admin.
   * 3. Creates the target folder structure if `folder_path` is provided and moves document.
   * 4. Sets permissions if `access_control` is specified.
   * 5. Transforms the copied file into the Document format.
   *
   * @param request The document creation request, including source reference, owner, name, folder path, and access control.
   * @returns The created Document object.
   * @throws {ProviderError} If any step fails during the process.
   */
  async copyDocumentFromSource(request: CreateDocumentRequest): Promise<Document> {
    try {
 
      // 1. Copy document
      const copiedFile = await this.operations.copyDocument(
        request.source_reference,
        request.source_owner,
        request.name,
      );

      // 2. Transfer ownership to admin
      await this.operations.transferToAdmin(request.source_owner, copiedFile.id!);

      // 3. Move to folder (if specified)
      if (request.folder_path) {
        const folderId = await this.operations.createPath(request.folder_path);
        await this.operations.moveToFolder(copiedFile.id!, folderId);
      }

      // 4. Set permissions (if specified)
      if (request.access_control && request.access_control.length > 0) {
        await this.operations.setPermissions(copiedFile.id!, request.access_control);
      }

      // 5. Transform to Document
      return this._toDocumentObject(copiedFile);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ProviderError(`Failed to create document: ${errorMessage}`, error);
    }
  }


  /**
   * Retrieves a document's metadata from Google Drive and transforms it into the Document format.
   *
   * @param documentId - The unique identifier of the Google Drive document.
   * @returns The corresponding Document object in the internal format.
   */
  async getDocument(documentId: string): Promise<Document> {
    // Fetch the file's metadata from Google Drive via the operations helper
    const file = await this.operations.getDocument(documentId);
    // Transform the Google Drive file object into the application's Document type
    return await this._transformToDocument(file);
  }



  // ==================== HELPER METHODS ====================

  /**
   * Converts a Google Drive file object to the internal Document format.
   *
   * @param file The Google Drive file to convert.
   * @returns The corresponding Document object.
   */
  private _toDocumentObject(file: drive_v3.Schema$File): Document {
    return {
      document_id: file.id!,
      provider: 'google_drive',
      storage_reference: file.id!,
      name: file.name || 'Untitled',
      access_url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
      created_at: file.createdTime || new Date().toISOString(),
      updated_at: file.modifiedTime || undefined,
    };
  }

}
