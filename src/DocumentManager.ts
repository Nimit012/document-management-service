import {
    IStorageProvider,
    Document,
    CreateDocumentRequest,
    AccessControl,
    Revision,
    Comment,
    SearchDocumentsResult,
  } from './types';
  import {
    validateCreateRequest,
    validateDocumentId,
    validateAccessControl,
    validateMetadata,
  } from '../utils/validators';
  
  /**
   * Document Manager
   * 
   * Main facade class that provides a unified interface for document operations.
   * Validates inputs and delegates to storage provider.
   */
  export class DocumentManager {
    constructor(private provider: IStorageProvider) {}
  
    /**
     * Create new document from source
     */
    async createDocument(request: CreateDocumentRequest): Promise<Document> {
      validateCreateRequest(request);
      return await this.provider.copyDocument(request);
    }
  
    /**
     * Get document by ID
     */
    async getDocument(documentId: string): Promise<Document> {
      validateDocumentId(documentId);
      return await this.provider.getDocument(documentId);
    }
  
    /**
     * List/search documents by metadata filters
     */
    async listDocuments(
      filters: Record<string, any>,
      limit: number = 20,
      offset: number = 0
    ): Promise<SearchDocumentsResult> {
      return await this.provider.searchByMetadata(filters, limit, offset);
    }
  
    /**
     * Update document name and/or metadata
     */
    async updateDocument(
      documentId: string,
      updates: { name?: string; metadata?: Record<string, any> }
    ): Promise<Document> {
      validateDocumentId(documentId);
      
      if (updates.metadata) {
        validateMetadata(updates.metadata);
      }
      
      return await this.provider.updateDocument(documentId, updates);
    }
  
    /**
     * Delete document
     */
    async deleteDocument(documentId: string): Promise<void> {
      validateDocumentId(documentId);
      return await this.provider.deleteDocument(documentId);
    }
  
    /**
     * Set access control (replaces all permissions)
     */
    async setAccessControl(
      documentId: string,
      accessControl: AccessControl[]
    ): Promise<void> {
      validateDocumentId(documentId);
      validateAccessControl(accessControl);
      return await this.provider.setPermissions(documentId, accessControl);
    }
  
    /**
     * Get current access control
     */
    async getAccessControl(documentId: string): Promise<AccessControl[]> {
      validateDocumentId(documentId);
      return await this.provider.getPermissions(documentId);
    }
  
    /**
     * Get document revisions (provider-specific)
     */
    async getRevisions(documentId: string): Promise<Revision[]> {
      validateDocumentId(documentId);
      
      if (!this.provider.getRevisions) {
        throw new Error('Revisions not supported by this provider');
      }
      
      return await this.provider.getRevisions(documentId);
    }
  
    /**
     * Get document comments (provider-specific)
     */
    async getComments(documentId: string): Promise<Comment[]> {
      validateDocumentId(documentId);
      
      if (!this.provider.getComments) {
        throw new Error('Comments not supported by this provider');
      }
      
      return await this.provider.getComments(documentId);
    }
  }