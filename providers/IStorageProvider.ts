import { Document, CreateDocumentRequest } from '../src/types';

/**
 * Interface for all storage providers (Google Drive, S3, Azure, etc.).
 *
 * Implementing this interface ensures a consistent API for document management operations,
 * regardless of the underlying storage technology.
 *
 * All operations are performed as the admin user (who owns all documents).
 * Only the `copyDocumentFromSource` method uses `source_owner` to impersonate for accessing source documents.
 */
export interface IStorageProvider {
  // ==================== DOCUMENT OPERATIONS ====================

  /**
   * Copies a document from a source reference to create a new document in the storage system.
   *
   * The method performs the following steps:
   * 1. Impersonates `source_owner` to access the source document.
   * 2. Copies the document to the target location.
   * 3. Transfers ownership to the admin user.
   * 4. Creates the folder structure if `folder_path` is provided.
   * 5. Sets metadata as custom properties.
   * 6. Grants permissions if `access_control` is provided.
   *
   * @param request The document creation request, including impersonation details and metadata.
   * @returns A promise resolving to the created document with its metadata.
   */
  copyDocumentFromSource(request: CreateDocumentRequest): Promise<Document>;

  /**
   * Get document metadata by ID
   * Always performed as admin (who owns all documents)
   *
   * @param documentId - Document identifier
   * @returns Document with current metadata
   */
  getDocument(documentId: string): Promise<Document>;

  /**
   * Update document name and/or metadata
   * Always performed as admin (who owns all documents)
   *
   * @param documentId - Document identifier
   * @param updates - Partial document updates (name, metadata)
   * @returns Updated document
   */
  updateDocument(
    documentId: string,
    updates: { name?: string; metadata?: Record<string, unknown> }
  ): Promise<Document>;

  /**
   * Delete document permanently
   * Always performed as admin (who owns all documents)
   *
   * @param documentId - Document identifier
   */
  deleteDocument(documentId: string): Promise<void>;
}
