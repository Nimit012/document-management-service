import { drive_v3 } from 'googleapis';
import { IStorageProvider } from '../IStorageProvider';
import {
  Document,
  CreateDocumentRequest,
  AccessControl,
  Revision,
  Comment,
  SearchDocumentsResult,
  GoogleDriveConfig,
  ProviderError,
  NotFoundError,
  NotImplementedError,
} from '../../src/types';
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
      console.log(`\n📄 Creating document from ${request.source_reference}...`);

      // Step 1: Create folder structure if needed
      let folderId: string | undefined;
      if (request.folder_path) {
        console.log(`📁 Creating folder path: ${request.folder_path}`);
        folderId = await this.folders.createPath(request.folder_path);
      }

      // Step 2: Copy document with ownership transfer
      const copiedFile = await this.operations.copyWithOwnershipTransfer(
        request.source_reference,
        request.source_owner,
        request.name,
        folderId
      );

      // Step 3: Set metadata if provided
      if (request.metadata && Object.keys(request.metadata).length > 0) {
        console.log(`📝 Setting metadata...`);
        await this.metadata.setMetadata(copiedFile.id!, request.metadata);
      }

      // Step 4: Set permissions if provided
      if (request.access_control && request.access_control.length > 0) {
        console.log(`🔐 Setting permissions...`);
        await this.permissions.setPermissions(copiedFile.id!, request.access_control);
      }

      // Step 5: Transform to Document format
      const document = await this.transformToDocument(copiedFile);

      console.log(`✅ Document created: ${document.document_id}\n`);
      return document;
    } catch (error: any) {
      throw new ProviderError(
        `Failed to create document: ${error.message}`,
        error
      );
    }
  }

  async getDocument(documentId: string): Promise<Document> {
    const file = await this.operations.getDocument(documentId);
    return await this.transformToDocument(file);
  }

  async updateDocument(
    documentId: string,
    updates: { name?: string; metadata?: Record<string, any> }
  ): Promise<Document> {
    try {
      // Update name if provided
      if (updates.name) {
        await this.operations.updateName(documentId, updates.name);
      }

      // Update metadata if provided
      if (updates.metadata) {
        // Merge with existing metadata
        const existingMetadata = await this.metadata.getMetadata(documentId);
        const mergedMetadata = { ...existingMetadata, ...updates.metadata };
        await this.metadata.setMetadata(documentId, mergedMetadata);
      }

      // Return updated document
      return await this.getDocument(documentId);
    } catch (error: any) {
      throw new ProviderError(
        `Failed to update document ${documentId}: ${error.message}`,
        error
      );
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.operations.deleteDocument(documentId);
  }

  // ==================== METADATA OPERATIONS ====================

  async setMetadata(documentId: string, metadata: Record<string, any>): Promise<void> {
    await this.metadata.setMetadata(documentId, metadata);
  }

  async getMetadata(documentId: string): Promise<Record<string, any>> {
    return await this.metadata.getMetadata(documentId);
  }

  async searchByMetadata(
    filters: Record<string, any>,
    limit: number = 20,
    offset: number = 0
  ): Promise<SearchDocumentsResult> {
    return await this.metadata.searchByMetadata(filters, limit, offset);
  }

  // ==================== ACCESS CONTROL ====================

  async setPermissions(
    documentId: string,
    accessControl: AccessControl[]
  ): Promise<void> {
    await this.permissions.setPermissions(documentId, accessControl);
  }

  async getPermissions(documentId: string): Promise<AccessControl[]> {
    return await this.permissions.getPermissions(documentId);
  }

  // ==================== FOLDER MANAGEMENT ====================

  async createFolderPath(path: string): Promise<string> {
    return await this.folders.createPath(path);
  }

  // ==================== OPTIONAL FEATURES ====================

  async getRevisions(documentId: string): Promise<Revision[]> {
    try {
      const adminEmail = this.authHelper.getAdminEmail();
      const adminDrive = this.authHelper.createDriveClient(adminEmail);

      const response = await adminDrive.revisions.list({
        fileId: documentId,
        fields: 'revisions(id,modifiedTime,lastModifyingUser,exportLinks)',
      });

      const revisions = response.data.revisions || [];

      return revisions.map((rev) => ({
        revision_id: rev.id!,
        modified_time: rev.modifiedTime!,
        modified_by: rev.lastModifyingUser?.emailAddress || 'Unknown',
        export_links: rev.exportLinks,
      }));
    } catch (error: any) {
      if (error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      throw new ProviderError(
        `Failed to get revisions for document ${documentId}: ${error.message}`,
        error
      );
    }
  }

  async getComments(documentId: string): Promise<Comment[]> {
    try {
      const adminEmail = this.authHelper.getAdminEmail();
      const adminDrive = this.authHelper.createDriveClient(adminEmail);

      const response = await adminDrive.comments.list({
        fileId: documentId,
        fields: 'comments(id,content,author,createdTime,resolved,replies)',
      });

      const comments = response.data.comments || [];

      return comments.map((comment) => ({
        comment_id: comment.id!,
        author: comment.author?.emailAddress || 'Unknown',
        content: comment.content!,
        created_at: comment.createdTime!,
        resolved: comment.resolved || false,
        replies: (comment.replies || []).map((reply) => ({
          reply_id: reply.id!,
          author: reply.author?.emailAddress || 'Unknown',
          content: reply.content!,
          created_at: reply.createdTime!,
        })),
      }));
    } catch (error: any) {
      if (error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      throw new ProviderError(
        `Failed to get comments for document ${documentId}: ${error.message}`,
        error
      );
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * Transform Google Drive file to Document format
   */
  private async transformToDocument(file: drive_v3.Schema$File): Promise<Document> {
    // Get metadata from properties
    let metadata: Record<string, any> = {};
    if (file.id) {
      try {
        metadata = await this.metadata.getMetadata(file.id);
      } catch (error) {
        console.warn(`Could not fetch metadata for ${file.id}:`, error);
      }
    }

    return {
      document_id: file.id!,
      provider: 'google_drive',
      storage_reference: file.id!,
      name: file.name || 'Untitled',
      access_url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
      created_at: file.createdTime || new Date().toISOString(),
      updated_at: file.modifiedTime,
      metadata,
    };
  }
}