import {
  Document,
  CreateDocumentRequest,
  AccessControl,
  SearchDocumentsResult,
  Comment,
  Revision
} from '../src/types';

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
   * 1. Impersonates `source_owner` (or 'admin' if not provided) to access the source document.
   * 2. Copies the document to the target location.
   * 3. Transfers ownership to the admin user.
   * 4. Creates the folder structure if `folder_path` is provided.
   * 5. Sets metadata as custom properties.
   * 6. Grants permissions if `access_control` is provided.
   *
   * @param request The document creation request, including optional source owner (defaults to 'admin'), impersonation details and metadata.
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

  /**
   * Set permissions on document (replaces all existing permissions except owner)
   * Always performed as admin (who owns all documents)
   *
   * Flow:
   * 1. List existing permissions
   * 2. Remove all non-owner permissions
   * 3. Create new permissions from access_control array
   *
   * @param documentId - Document identifier
   * @param accessControl - Array of access control rules
   */
  setPermissions(documentId: string, accessControl: AccessControl[]): Promise<void>;

  /**
   * Search documents by metadata filters
   * Always performed as admin (who owns all documents)
   *
   * Example: { activity_id: 'act_123', document_type: 'student_copy' }
   *
   * @param filters - Metadata key-value filters
   * @param limit - Maximum results to return (default: 20)
   * @param offset - Pagination offset (default: 0)
   * @returns Search results with documents
   */
  searchByMetadata(
    filters: Record<string, unknown>,
    limit?: number,
    pageToken?: string
  ): Promise<SearchDocumentsResult>;

  /**
   * Get comments on document (optional - provider-specific)
   * Always performed as admin (who owns all documents)
   *
   * Google Drive: Fully supported
   * S3: Not supported (returns empty array or throws NotImplementedError)
   *
   * @param documentId - Document identifier
   * @returns Array of comments
   */
  getComments?(documentId: string): Promise<Comment[]>;

  /**
   * Get revision history for document (optional - provider-specific)
   * Always performed as admin (who owns all documents)
   *
   * Google Drive: Fully supported
   * S3: Not supported (returns empty array or throws NotImplementedError)
   *
   * @param documentId - Document identifier
   * @returns Array of revisions
   */
  getRevisions?(documentId: string): Promise<Revision[]>;
}
