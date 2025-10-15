import {
    Document,
    CreateDocumentRequest,
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

  }