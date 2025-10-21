import { GoogleDriveProvider } from '../providers/google-drive/GoogleDriveProvider';
import {
  Document,
  CreateDocumentRequest,
  GoogleDriveConfig,
  ValidationError,
  ProviderType
} from './types';

import { IStorageProvider } from '../providers/IStorageProvider';

/**
 * Configuration options for the DocumentManager.
 * @property provider The type of storage provider ('google_drive' or 's3').
 * @property config Provider-specific configuration. Currently only GoogleDriveConfig is supported.
 */
interface DocumentManagerConfig {
  /** The type of storage provider to use. */
  provider: ProviderType;

  /** Provider-specific configuration. */
  config: GoogleDriveConfig; // Will be union type when S3 added
}

/**
 * Main facade class providing a unified interface for document operations.
 * Automatically instantiates the correct storage provider based on configuration.
 */
export class DocumentManager {
  /** The underlying storage provider instance. */
  private provider: IStorageProvider;

  /**
   * Constructs a DocumentManager instance with the specified configuration.
   * @param options Configuration for selecting and initializing the storage provider.
   * @throws {ValidationError} If the provider type is unsupported.
   * @throws {Error} If the S3 provider is selected (not yet implemented).
   */
  constructor(options: DocumentManagerConfig) {
    // Create provider based on type
    if (options.provider === ProviderType.GOOGLE_DRIVE) {
      this.provider = new GoogleDriveProvider(options.config);
    } else if (options.provider === ProviderType.S3) {
      throw new Error('S3 provider not yet implemented');
    } else {
      throw new ValidationError(`Unsupported provider: ${options.provider}`);
    }
  }

  /**
   * Creates a new document from the specified source.
   * @param request Details for the document to be created.
   * @returns The created Document object.
   */
  async createDocument(request: CreateDocumentRequest): Promise<Document> {
    // validateCreateRequest(request);
    return await this.provider.copyDocumentFromSource(request);
  }

  /**
   * Get document by ID
   * @param documentId - The unique identifier of the document.
   * @returns A promise resolving to the found Document object, if it exists.
   */
  async getDocument(documentId: string): Promise<Document> {
    // validateDocumentId(documentId);
    return await this.provider.getDocument(documentId);
  }

  /**
   * Update document name and/or metadata
   */
  /**
   * Updates a document's name and/or metadata.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - ID of the document to update.
   * @param updates - Object containing the new name and/or metadata to set.
   * @returns The updated Document object.
   */
  async updateDocument(
    documentId: string,
    updates: { name?: string; metadata?: Record<string, unknown> }
  ): Promise<Document> {
    // validateDocumentId(documentId);

    // if (updates.metadata) {
    //   validateMetadata(updates.metadata);
    // }

    return await this.provider.updateDocument(documentId, updates);
  }

  /**
   * Delete document
   */
  /**
   * Deletes a document permanently by its document ID.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document to delete.
   * @returns A promise that resolves when the document is deleted.
   */
  async deleteDocument(documentId: string): Promise<void> {
    // validateDocumentId(documentId);
    return await this.provider.deleteDocument(documentId);
  }
}
