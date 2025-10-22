import { Document, CreateDocumentRequest, GoogleDriveConfig, ProviderType, AccessControl, SearchDocumentsResult, Comment, Revision } from './types';
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
export declare class DocumentManager {
    /** The underlying storage provider instance. */
    private provider;
    /**
     * Constructs a DocumentManager instance with the specified configuration.
     * @param options Configuration for selecting and initializing the storage provider.
     * @throws {ValidationError} If the provider type is unsupported.
     * @throws {Error} If the S3 provider is selected (not yet implemented).
     */
    constructor(options: DocumentManagerConfig);
    /**
     * Creates a new document from the specified source.
     * @param request Details for the document to be created.
     * @returns The created Document object.
     */
    createDocument(request: CreateDocumentRequest): Promise<Document>;
    /**
     * Get document by ID
     * @param documentId - The unique identifier of the document.
     * @returns A promise resolving to the found Document object, if it exists.
     */
    getDocument(documentId: string): Promise<Document>;
    /**
     * Updates a document's name and/or metadata.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - ID of the document to update.
     * @param updates - Object containing the new name and/or metadata to set.
     * @returns The updated Document object.
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
     */
    deleteDocument(documentId: string): Promise<void>;
    /**
     * Sets the access control (permissions) for a document, replacing all existing permissions.
     *
     * @param documentId - The unique identifier of the document to update permissions for.
     * @param accessControl - An array of AccessControl objects specifying the new permissions.
     * @returns A promise that resolves when permissions are set.
     */
    setAccessControl(documentId: string, accessControl: AccessControl[]): Promise<void>;
    /**
     * Lists or searches for documents matching the provided metadata filters.
     *
     * @param filters - An object containing metadata key-value pairs to filter documents.
     * @param limit - The maximum number of documents to retrieve (default: 20).
     * @param offset - The number of documents to skip before starting to collect the result set (default: 0).
     * @returns A promise that resolves to a SearchDocumentsResult containing the found documents and any pagination info.
     */
    listDocuments(filters: Record<string, unknown>, limit?: number, pageToken?: string): Promise<SearchDocumentsResult>;
    /**
     * Retrieves comments for a given document, if supported by the provider.
     *
     * @param documentId - The unique identifier of the document to get comments for.
     * @returns A promise that resolves to an array of Comment objects.
     * @throws Error if comments are not supported by the underlying provider.
     */
    getComments(documentId: string): Promise<Comment[]>;
    /**
     * Retrieves the revision history for a given document, if supported by the provider.
     *
     * @param documentId - The unique identifier of the document to get revisions for.
     * @returns A promise that resolves to an array of Revision objects.
     * @throws Error if revisions are not supported by the underlying provider.
     */
    getRevisions(documentId: string): Promise<Revision[]>;
}
export {};
