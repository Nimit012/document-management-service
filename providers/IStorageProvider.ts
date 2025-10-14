import {
    Document,
    CreateDocumentRequest,
    AccessControl,
    Revision,
    Comment,
    SearchDocumentsResult,
  } from '../src/types';
  
  /**
   * Storage Provider Interface
   * 
   * All storage providers (Google Drive, S3, Azure, etc.) must implement this interface.
   * This ensures consistent API regardless of underlying storage.
   * 
   * Note: All operations are performed as admin (who owns all documents).
   * Only copyDocument uses source_owner to impersonate for accessing source documents.
   */
  export interface IStorageProvider {
    // ==================== DOCUMENT OPERATIONS ====================
    
    /**
     * Copy a document from source reference to create a new document
     * 
     * Flow:
     * 1. Impersonate source_owner to access the source document
     * 2. Copy the document
     * 3. Transfer ownership to admin
     * 4. Create folder structure (if folder_path provided)
     * 5. Set metadata as custom properties
     * 6. Grant permissions (if access_control provided)
     * 
     * @param request - Document creation request (includes source_owner for impersonation)
     * @returns Created document with metadata
     */
    copyDocument(request: CreateDocumentRequest): Promise<Document>;
  
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
      updates: { name?: string; metadata?: Record<string, any> }
    ): Promise<Document>;
  
    /**
     * Delete document permanently
     * Always performed as admin (who owns all documents)
     * 
     * @param documentId - Document identifier
     */
    deleteDocument(documentId: string): Promise<void>;
  
    // ==================== METADATA OPERATIONS ====================
    
    /**
     * Set custom metadata on document
     * Stored as provider-specific properties (Google Drive custom properties, S3 tags, etc.)
     * NO DATABASE - metadata lives with the file in the storage provider
     * Always performed as admin (who owns all documents)
     * 
     * @param documentId - Document identifier
     * @param metadata - Key-value metadata object
     */
    setMetadata(documentId: string, metadata: Record<string, any>): Promise<void>;
  
    /**
     * Get custom metadata from document
     * Always performed as admin (who owns all documents)
     * 
     * @param documentId - Document identifier
     * @returns Metadata object
     */
    getMetadata(documentId: string): Promise<Record<string, any>>;
  
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
      filters: Record<string, any>,
      limit?: number,
      offset?: number
    ): Promise<SearchDocumentsResult>;
  
    // ==================== ACCESS CONTROL ====================
    
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
    setPermissions(
      documentId: string,
      accessControl: AccessControl[]
    ): Promise<void>;
  
    /**
     * Get current permissions on document
     * Always performed as admin (who owns all documents)
     * 
     * @param documentId - Document identifier
     * @returns Array of current access control rules (excludes owner)
     */
    getPermissions(documentId: string): Promise<AccessControl[]>;
  
    // ==================== FOLDER MANAGEMENT ====================
    
    /**
     * Create nested folder structure
     * Always performed as admin (who owns all folders)
     * 
     * Example: "course/unit1/masters" creates:
     * - course/
     * - course/unit1/
     * - course/unit1/masters/
     * 
     * @param path - Folder path (e.g., "course/unit1/masters")
     * @returns ID of final folder in path
     */
    createFolderPath(path: string): Promise<string>;
  
    // ==================== OPTIONAL PROVIDER-SPECIFIC FEATURES ====================
    
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
  }