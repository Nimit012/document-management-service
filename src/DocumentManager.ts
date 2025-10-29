import { GoogleDriveProvider } from '../providers/google-drive/GoogleDriveProvider';
import {
  Document,
  CreateDocumentRequest,
  GoogleDriveConfig,
  ValidationError,
  ProviderType,
  AccessControl,
  SearchDocumentsResult,
  Comment,
  Revision,
  NotImplementedError
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
   * @throws {ValidationError} If the provider type is unsupported or configuration is invalid.
   */
  constructor(options: DocumentManagerConfig) {
    if (!options) {
      throw new ValidationError('Configuration options are required');
    }
    if (!options.provider) {
      throw new ValidationError('Provider type is required');
    }
    if (!options.config) {
      throw new ValidationError('Provider configuration is required');
    }

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
   * @throws {ValidationError} If source_reference is missing or invalid.
   */
  async createDocument(request: CreateDocumentRequest): Promise<Document> {
    if (!request) {
      throw new ValidationError('Request object is required');
    }

    // Validate source_reference (required)
    if (!request.source_reference || typeof request.source_reference !== 'string' || request.source_reference.trim() === '') {
      throw new ValidationError('source_reference is required and cannot be empty');
    }

    // Validate source_owner if provided
    if (request.source_owner !== undefined) {
      if (typeof request.source_owner !== 'string' || request.source_owner.trim() === '') {
        throw new ValidationError('source_owner must be a non-empty email string');
      }
      if (!this._isValidEmail(request.source_owner)) {
        throw new ValidationError(`Invalid email format for source_owner: ${request.source_owner}`);
      }
    }

    // Validate name if provided
    if (request.name !== undefined) {
      if (typeof request.name !== 'string') {
        throw new ValidationError('name must be a string');
      }
    }

    // Validate folder_path if provided
    if (request.folder_path !== undefined) {
      if (typeof request.folder_path !== 'string' || request.folder_path.trim() === '') {
        throw new ValidationError('folder_path must be a non-empty string');
      }
    }

    // Validate access_control if provided
    if (request.access_control) {
      this._validateAccessControl(request.access_control);
    }

    // Validate metadata if provided
    if (request.metadata !== undefined) {
      this._validateMetadata(request.metadata);
    }

    return await this.provider.copyDocumentFromSource(request);
  }

  /**
   * Get document by ID
   * @param documentId - The unique identifier of the document.
   * @returns A promise resolving to the found Document object, if it exists.
   * @throws {ValidationError} If documentId is missing or invalid.
   */
  async getDocument(documentId: string): Promise<Document> {
    this._validateDocumentId(documentId);
    return await this.provider.getDocument(documentId);
  }

  /**
   * Updates a document's name and/or metadata.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - ID of the document to update.
   * @param updates - Object containing the new name and/or metadata to set.
   * @returns The updated Document object.
   * @throws {ValidationError} If documentId or updates are invalid.
   */
  async updateDocument(
    documentId: string,
    updates: { name?: string; metadata?: Record<string, unknown> }
  ): Promise<Document> {
    this._validateDocumentId(documentId);

    if (!updates) {
      throw new ValidationError('Updates object is required');
    }

    const hasName = updates.name !== undefined;
    const hasMetadata = updates.metadata !== undefined;

    if (!hasName && !hasMetadata) {
      throw new ValidationError('At least one of name or metadata must be provided for update');
    }

    if (hasName && (typeof updates.name !== 'string' || updates.name.trim() === '')) {
      throw new ValidationError('name must be a non-empty string');
    }

    if (hasMetadata && updates.metadata !== undefined) {
      this._validateMetadata(updates.metadata);
    }

    return await this.provider.updateDocument(documentId, updates);
  }

  /**
   * Deletes a document permanently by its document ID.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document to delete.
   * @returns A promise that resolves when the document is deleted.
   * @throws {ValidationError} If documentId is missing or invalid.
   */
  async deleteDocument(documentId: string): Promise<void> {
    this._validateDocumentId(documentId);
    return await this.provider.deleteDocument(documentId);
  }

  /**
   * Sets the access control (permissions) for a document, replacing all existing permissions.
   *
   * @param documentId - The unique identifier of the document to update permissions for.
   * @param accessControl - An array of AccessControl objects specifying the new permissions.
   * @returns A promise that resolves when permissions are set.
   * @throws {ValidationError} If documentId or accessControl are invalid.
   */
  async setAccessControl(documentId: string, accessControl: AccessControl[]): Promise<void> {
    this._validateDocumentId(documentId);
    this._validateAccessControl(accessControl);
    return await this.provider.setPermissions(documentId, accessControl);
  }

  /**
   * Lists or searches for documents matching the provided metadata filters.
   *
   * @param filters - An object containing metadata key-value pairs to filter documents.
   * @param limit - The maximum number of documents to retrieve (default: 20).
   * @param pageToken - Optional token for pagination (obtained from previous search).
   * @returns A promise that resolves to a SearchDocumentsResult containing the found documents and any pagination info.
   * @throws {ValidationError} If limit is invalid or filters are not an object.
   */
  async listDocuments(
    filters: Record<string, unknown>,
    limit: number = 20,
    pageToken?: string
  ): Promise<SearchDocumentsResult> {
    // Validate filters
    if (filters === null || filters === undefined) {
      throw new ValidationError('filters must be an object');
    }
    if (typeof filters !== 'object' || Array.isArray(filters)) {
      throw new ValidationError('filters must be an object, not an array or null');
    }

    // Validate limit
    if (!Number.isInteger(limit) || limit < 1) {
      throw new ValidationError('limit must be a positive integer (at least 1)');
    }
    if (limit > 100) {
      throw new ValidationError('limit must not exceed 100');
    }

    // Validate pageToken if provided
    if (pageToken !== undefined) {
      if (typeof pageToken !== 'string' || pageToken.trim() === '') {
        throw new ValidationError('pageToken must be a non-empty string');
      }
    }

    return await this.provider.searchByMetadata(filters, limit, pageToken);
  }



  /**
   * Retrieves comments for a given document, if supported by the provider.
   *
   * @param documentId - The unique identifier of the document to get comments for.
   * @returns A promise that resolves to an array of Comment objects.
   * @throws {ValidationError} If documentId is invalid.
   * @throws {NotImplementedError} If comments are not supported by the provider.
   */
  async getComments(documentId: string): Promise<Comment[]> {
    this._validateDocumentId(documentId);
    
    if (!this.provider.getComments) {
      throw new NotImplementedError('Comments', this.constructor.name);
    }
    
    return await this.provider.getComments(documentId);
  }


  /**
   * Retrieves the revision history for a given document, if supported by the provider.
   *
   * @param documentId - The unique identifier of the document to get revisions for.
   * @returns A promise that resolves to an array of Revision objects.
   * @throws {ValidationError} If documentId is invalid.
   * @throws {NotImplementedError} If revisions are not supported by the provider.
   */
  async getRevisions(documentId: string): Promise<Revision[]> {
    this._validateDocumentId(documentId);
    
    if (!this.provider.getRevisions) {
      throw new NotImplementedError('Revisions', this.constructor.name);
    }
    
    return await this.provider.getRevisions(documentId);
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Validates that a documentId is non-empty and properly formatted.
   * @param documentId - The document ID to validate.
   * @throws {ValidationError} If the documentId is invalid.
   */
  private _validateDocumentId(documentId: string): void {
    if (!documentId || typeof documentId !== 'string' || documentId.trim() === '') {
      throw new ValidationError('documentId is required and cannot be empty');
    }
  }

  /**
   * Validates an array of AccessControl objects.
   * @param accessControl - The access control array to validate.
   * @throws {ValidationError} If the access control array or any entry is invalid.
   */
  private _validateAccessControl(accessControl: AccessControl[]): void {
    if (!Array.isArray(accessControl)) {
      throw new ValidationError('accessControl must be an array');
    }

    if (accessControl.length === 0) {
      throw new ValidationError('accessControl array cannot be empty');
    }

    const validAccessLevels = ['read', 'read_write', 'comment'];
    for (let i = 0; i < accessControl.length; i++) {
      const ac = accessControl[i];
      
      if (!ac || typeof ac !== 'object') {
        throw new ValidationError(`accessControl[${i}] must be an object`);
      }

      if (!ac.user || typeof ac.user !== 'string' || ac.user.trim() === '') {
        throw new ValidationError(`accessControl[${i}].user must be a non-empty email string`);
      }

      if (!this._isValidEmail(ac.user)) {
        throw new ValidationError(`Invalid email format for accessControl[${i}].user: ${ac.user}`);
      }

      if (!ac.access_level || typeof ac.access_level !== 'string') {
        throw new ValidationError(`accessControl[${i}].access_level must be a string`);
      }

      if (!validAccessLevels.includes(ac.access_level)) {
        throw new ValidationError(
          `accessControl[${i}].access_level must be one of: ${validAccessLevels.join(', ')}`
        );
      }
    }
  }

  /**
   * Validates metadata object structure.
   * @param metadata - The metadata to validate.
   * @throws {ValidationError} If metadata is not a valid object.
   */
  private _validateMetadata(metadata: Record<string, unknown>): void {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      throw new ValidationError('metadata must be an object');
    }

    // Check for non-serializable values
    for (const [key, value] of Object.entries(metadata)) {
      if (typeof key !== 'string' || key.trim() === '') {
        throw new ValidationError('Metadata keys must be non-empty strings');
      }

      // Check for undefined (which is not JSON serializable)
      if (value === undefined) {
        throw new ValidationError(`Metadata value for key '${key}' cannot be undefined. Use null instead.`);
      }

      // Check for functions (not serializable)
      if (typeof value === 'function') {
        throw new ValidationError(`Metadata value for key '${key}' cannot be a function`);
      }
    }
  }

  /**
   * Validates if a string is a valid email format.
   * @param email - The email string to validate.
   * @returns True if the email is valid, false otherwise.
   */
  private _isValidEmail(email: string): boolean {
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
