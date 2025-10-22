import { IStorageProvider } from '../IStorageProvider';
import { Document, CreateDocumentRequest, GoogleDriveConfig, AccessControl, SearchDocumentsResult, Comment, Revision } from '../../src/types';
/**
 * Google Drive Storage Provider implementation.
 *
 * Implements the {@link IStorageProvider} interface for Google Drive.
 * Orchestrates authentication, document operations, permissions, and metadata
 * to provide complete document management functionality.
 */
export declare class GoogleDriveProvider implements IStorageProvider {
    /**
     * Helper for Google authentication and impersonation.
     */
    private authHelper;
    /**
     * Handles document-level operations (copy, move, get, folder management).
     */
    private operations;
    /**
     * Handles permission and ownership operations.
     */
    private permissions;
    /**
     * Handles metadata operations.
     */
    private metadata;
    /**
     * Constructs a new GoogleDriveProvider instance.
     * @param config The configuration object for Google Drive integration.
     */
    constructor(config: GoogleDriveConfig);
    /**
     * Copies a document in Google Drive according to the request details.
     *
     * Steps:
     * 1. Copies the source document, impersonating the source owner.
     * 2. Transfers ownership to admin.
     * 3. Creates the target folder structure if `folder_path` is provided and moves document.
     * 4. Sets permissions if `access_control` is specified.
     * 5. Sets metadata if `metadata` is specified.
     * 6. Transforms the copied file into the Document format.
     *
     * @param request The document creation request, including source reference, owner, name, folder path, access control, and metadata.
     * @returns The created Document object.
     * @throws {ProviderError} If any step fails during the process.
     */
    copyDocumentFromSource(request: CreateDocumentRequest): Promise<Document>;
    /**
     * Retrieves a document's metadata from Google Drive and transforms it into the Document format.
     *
     * @param documentId - The unique identifier of the Google Drive document.
     * @returns The corresponding Document object in the internal format.
     */
    getDocument(documentId: string): Promise<Document>;
    /**
     * Updates a document's name and/or metadata in Google Drive.
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
     * Deletes a document permanently by its ID from Google Drive.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - The unique identifier of the document to delete.
     * @returns A promise that resolves when the document is deleted.
     */
    deleteDocument(documentId: string): Promise<void>;
    /**
     * Sets access permissions for a document, replacing all existing non-owner permissions.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - The unique identifier of the document to update permissions for.
     * @param accessControl - Array of AccessControl rules to apply.
     * @returns A promise that resolves when permissions are set.
     */
    setPermissions(documentId: string, accessControl: AccessControl[]): Promise<void>;
    /**
     * Searches for documents by metadata filters in Google Drive.
     * Always performed as admin (who owns all documents).
     *
     * @param filters - Key-value pairs of metadata fields to filter.
     * @param limit - Maximum number of documents to return (default: 20).
     * @param offset - Pagination offset (default: 0).
     * @returns A promise resolving to a SearchDocumentsResult with found documents.
     */
    searchByMetadata(filters: Record<string, unknown>, limit?: number, pageToken?: string): Promise<SearchDocumentsResult>;
    /**
     * Retrieves comments for a specific document from Google Drive.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - The unique identifier of the document.
     * @returns A promise resolving to an array of Comment objects.
     */
    getComments(documentId: string): Promise<Comment[]>;
    /**
     * Retrieves revision history for a specific document from Google Drive.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - The unique identifier of the document.
     * @returns A promise resolving to an array of Revision objects.
     */
    getRevisions(documentId: string): Promise<Revision[]>;
    /**
     * Converts a Google Drive file object to the internal Document format.
     *
     * @param file The Google Drive file to convert.
     * @returns The corresponding Document object.
     */
    private _toDocumentObject;
}
