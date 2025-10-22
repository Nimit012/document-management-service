import { GoogleDriveProvider } from '../providers/google-drive/GoogleDriveProvider';
import { ValidationError, ProviderType } from './types';
/**
 * Main facade class providing a unified interface for document operations.
 * Automatically instantiates the correct storage provider based on configuration.
 */
export class DocumentManager {
    /**
     * Constructs a DocumentManager instance with the specified configuration.
     * @param options Configuration for selecting and initializing the storage provider.
     * @throws {ValidationError} If the provider type is unsupported.
     * @throws {Error} If the S3 provider is selected (not yet implemented).
     */
    constructor(options) {
        // Create provider based on type
        if (options.provider === ProviderType.GOOGLE_DRIVE) {
            this.provider = new GoogleDriveProvider(options.config);
        }
        else if (options.provider === ProviderType.S3) {
            throw new Error('S3 provider not yet implemented');
        }
        else {
            throw new ValidationError(`Unsupported provider: ${options.provider}`);
        }
    }
    /**
     * Creates a new document from the specified source.
     * @param request Details for the document to be created.
     * @returns The created Document object.
     */
    async createDocument(request) {
        return await this.provider.copyDocumentFromSource(request);
    }
    /**
     * Get document by ID
     * @param documentId - The unique identifier of the document.
     * @returns A promise resolving to the found Document object, if it exists.
     */
    async getDocument(documentId) {
        return await this.provider.getDocument(documentId);
    }
    /**
     * Updates a document's name and/or metadata.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - ID of the document to update.
     * @param updates - Object containing the new name and/or metadata to set.
     * @returns The updated Document object.
     */
    async updateDocument(documentId, updates) {
        return await this.provider.updateDocument(documentId, updates);
    }
    /**
     * Deletes a document permanently by its document ID.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - The unique identifier of the document to delete.
     * @returns A promise that resolves when the document is deleted.
     */
    async deleteDocument(documentId) {
        return await this.provider.deleteDocument(documentId);
    }
    /**
     * Sets the access control (permissions) for a document, replacing all existing permissions.
     *
     * @param documentId - The unique identifier of the document to update permissions for.
     * @param accessControl - An array of AccessControl objects specifying the new permissions.
     * @returns A promise that resolves when permissions are set.
     */
    async setAccessControl(documentId, accessControl) {
        return await this.provider.setPermissions(documentId, accessControl);
    }
    /**
     * Lists or searches for documents matching the provided metadata filters.
     *
     * @param filters - An object containing metadata key-value pairs to filter documents.
     * @param limit - The maximum number of documents to retrieve (default: 20).
     * @param offset - The number of documents to skip before starting to collect the result set (default: 0).
     * @returns A promise that resolves to a SearchDocumentsResult containing the found documents and any pagination info.
     */
    async listDocuments(filters, limit = 20, pageToken) {
        return await this.provider.searchByMetadata(filters, limit, pageToken);
    }
    /**
     * Retrieves comments for a given document, if supported by the provider.
     *
     * @param documentId - The unique identifier of the document to get comments for.
     * @returns A promise that resolves to an array of Comment objects.
     * @throws Error if comments are not supported by the underlying provider.
     */
    async getComments(documentId) {
        if (!this.provider.getComments) {
            throw new Error('Comments not supported by this provider');
        }
        return await this.provider.getComments(documentId);
    }
    /**
     * Retrieves the revision history for a given document, if supported by the provider.
     *
     * @param documentId - The unique identifier of the document to get revisions for.
     * @returns A promise that resolves to an array of Revision objects.
     * @throws Error if revisions are not supported by the underlying provider.
     */
    async getRevisions(documentId) {
        if (!this.provider.getRevisions) {
            throw new Error('Revisions not supported by this provider');
        }
        return await this.provider.getRevisions(documentId);
    }
}
