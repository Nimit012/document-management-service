//#region src/types/common.types.d.ts
/**
 * Core document type returned by all operations
 */
interface Document {
  document_id: string;
  storage_reference: string;
  name: string;
  access_url: string;
  folder_path?: string;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}
/**
 * Request to create a new document by copying from source
 */
interface CreateDocumentRequest {
  source_reference: string;
  source_owner?: string;
  name?: string;
  folder_path?: string;
  access_control?: AccessControl[];
  metadata?: Record<string, unknown>;
}
/**
 * Access control rule for document permissions
 */
interface AccessControl {
  user: string;
  access_level: 'read' | 'read_write' | 'comment';
}
/**
 * Document revision (Google Drive specific)
 */
interface Revision {
  revision_id: string;
  modified_time: string;
  modified_by: string;
  export_links?: Record<string, string>;
}
/**
 * Document comment (Google Drive specific)
 */
interface Comment {
  comment_id: string;
  author: string;
  content: string;
  created_at: string;
  resolved: boolean;
  replies?: CommentReply[];
}
interface CommentReply {
  reply_id: string;
  author: string;
  content: string;
  created_at: string;
}
/**
 * Search/list parameters
 */
interface SearchDocumentsParams {
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}
/**
 * Search results with pagination
 */
interface SearchDocumentsResult {
  documents: Document[];
  nextPageToken?: string | null;
  limit: number;
}
//#endregion
//#region src/types/provider.types.d.ts
/**
 * Supported storage provider types
 */
declare enum ProviderType {
  GOOGLE_DRIVE = "google_drive",
  S3 = "s3",
}
/**
 * Google Drive provider configuration
 */
interface GoogleDriveConfig {
  serviceAccountKey: ServiceAccountKey;
  adminEmail: string;
}
/**
 * Service account key structure (from Google Cloud)
 */
interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}
/**
 * S3 provider configuration (future)
 */
interface S3Config {
  region: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}
/**
 * Union type for all provider configs
 */
type ProviderConfig = GoogleDriveConfig | S3Config;
//#endregion
//#region src/types/errors.types.d.ts
/**
 * Base error for all library errors
 */
declare class DocumentStorageError extends Error {
  constructor(message: string);
}
/**
 * Provider-specific errors (API failures, etc.)
 */
declare class ProviderError extends DocumentStorageError {
  originalError?: unknown | undefined;
  constructor(message: string, originalError?: unknown | undefined);
}
/**
 * Validation errors (bad input)
 */
declare class ValidationError extends DocumentStorageError {
  constructor(message: string);
}
/**
 * Resource not found errors
 */
declare class NotFoundError extends DocumentStorageError {
  constructor(resourceType: string, resourceId: string);
}
/**
 * Permission/authorization errors
 */
declare class PermissionError extends DocumentStorageError {
  constructor(message: string);
}
/**
 * Feature not implemented by provider
 */
declare class NotImplementedError extends DocumentStorageError {
  constructor(feature: string, provider: string);
}
//#endregion
//#region src/DocumentManager.d.ts
/**
 * Configuration options for the DocumentManager.
 * @property provider The type of storage provider ('google_drive' or 's3').
 * @property config Provider-specific configuration. Currently only GoogleDriveConfig is supported.
 */
interface DocumentManagerConfig {
  /** The type of storage provider to use. */
  provider: ProviderType;
  /** Provider-specific configuration. */
  config: GoogleDriveConfig;
}
/**
 * Main facade class providing a unified interface for document operations.
 * Automatically instantiates the correct storage provider based on configuration.
 */
declare class DocumentManager {
  /** The underlying storage provider instance. */
  private provider;
  /**
   * Constructs a DocumentManager instance with the specified configuration.
   * @param options Configuration for selecting and initializing the storage provider.
   * @throws {ValidationError} If the provider type is unsupported or configuration is invalid.
   */
  constructor(options: DocumentManagerConfig);
  /**
   * Creates a new document from the specified source.
   * @param request Details for the document to be created.
   * @returns The created Document object.
   * @throws {ValidationError} If source_reference is missing or invalid.
   */
  createDocument(request: CreateDocumentRequest): Promise<Document>;
  /**
   * Get document by ID
   * @param documentId - The unique identifier of the document.
   * @returns A promise resolving to the found Document object, if it exists.
   * @throws {ValidationError} If documentId is missing or invalid.
   */
  getDocument(documentId: string): Promise<Document>;
  /**
   * Updates a document's name and/or metadata.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - ID of the document to update.
   * @param updates - Object containing the new name and/or metadata to set.
   * @returns The updated Document object.
   * @throws {ValidationError} If documentId or updates are invalid.
   */
  updateDocument(documentId: string, updates: {
    name?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Document>;
  /**
   * Deletes a document permanently by its document ID.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document to delete.
   * @returns A promise that resolves when the document is deleted.
   * @throws {ValidationError} If documentId is missing or invalid.
   */
  deleteDocument(documentId: string): Promise<void>;
  /**
   * Sets the access control (permissions) for a document, replacing all existing permissions.
   *
   * @param documentId - The unique identifier of the document to update permissions for.
   * @param accessControl - An array of AccessControl objects specifying the new permissions.
   * @returns A promise that resolves when permissions are set.
   * @throws {ValidationError} If documentId or accessControl are invalid.
   */
  setAccessControl(documentId: string, accessControl: AccessControl[]): Promise<void>;
  /**
   * Lists or searches for documents matching the provided metadata filters.
   *
   * @param filters - An object containing metadata key-value pairs to filter documents.
   * @param limit - The maximum number of documents to retrieve (default: 20).
   * @param pageToken - Optional token for pagination (obtained from previous search).
   * @returns A promise that resolves to a SearchDocumentsResult containing the found documents and any pagination info.
   * @throws {ValidationError} If limit is invalid or filters are not an object.
   */
  listDocuments(filters: Record<string, unknown>, limit?: number, pageToken?: string): Promise<SearchDocumentsResult>;
  /**
   * Retrieves comments for a given document, if supported by the provider.
   *
   * @param documentId - The unique identifier of the document to get comments for.
   * @returns A promise that resolves to an array of Comment objects.
   * @throws {ValidationError} If documentId is invalid.
   * @throws {NotImplementedError} If comments are not supported by the provider.
   */
  getComments(documentId: string): Promise<Comment[]>;
  /**
   * Retrieves the revision history for a given document, if supported by the provider.
   *
   * @param documentId - The unique identifier of the document to get revisions for.
   * @returns A promise that resolves to an array of Revision objects.
   * @throws {ValidationError} If documentId is invalid.
   * @throws {NotImplementedError} If revisions are not supported by the provider.
   */
  getRevisions(documentId: string): Promise<Revision[]>;
  /**
   * Validates that a documentId is non-empty and properly formatted.
   * @param documentId - The document ID to validate.
   * @throws {ValidationError} If the documentId is invalid.
   */
  private _validateDocumentId;
  /**
   * Validates an array of AccessControl objects.
   * @param accessControl - The access control array to validate.
   * @throws {ValidationError} If the access control array or any entry is invalid.
   */
  private _validateAccessControl;
  /**
   * Validates metadata object structure.
   * @param metadata - The metadata to validate.
   * @throws {ValidationError} If metadata is not a valid object.
   */
  private _validateMetadata;
  /**
   * Validates if a string is a valid email format.
   * @param email - The email string to validate.
   * @returns True if the email is valid, false otherwise.
   */
  private _isValidEmail;
}
//#endregion
export { AccessControl, Comment, CommentReply, CreateDocumentRequest, Document, DocumentManager, DocumentStorageError, GoogleDriveConfig, NotFoundError, NotImplementedError, PermissionError, ProviderConfig, ProviderError, ProviderType, Revision, S3Config, SearchDocumentsParams, SearchDocumentsResult, ServiceAccountKey, ValidationError };