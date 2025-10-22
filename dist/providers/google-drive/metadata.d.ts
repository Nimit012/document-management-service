import { GoogleAuthHelper } from './auth';
import { SearchDocumentsResult } from '../../src/types';
/**
 * Metadata management for Google Drive documents.
 *
 * Handles retrieval and updates of document metadata.
 */
export declare class DocumentMetadata {
    /**
     * Helper for Google authentication and impersonation.
     */
    private authHelper;
    /**
     * Constructs a new DocumentMetadata instance.
     * @param authHelper The authentication helper for creating Drive clients.
     */
    constructor(authHelper: GoogleAuthHelper);
    /**
     * Set custom metadata on a document
     * Stored as Google Drive file properties
     * Always performed as admin
     *
     * Note: Google Drive properties are key-value strings.
     * Non-string values are JSON-stringified.
     *
     * @param documentId - Document ID
     * @param metadata - Key-value metadata object
     */
    setMetadata(documentId: string, metadata: Record<string, unknown>): Promise<void>;
    /**
     * Get custom metadata from a document
     * Always performed as admin
     *
     * @param documentId - Document ID
     * @returns Metadata object (with values parsed back from strings)
     */
    getMetadata(documentId: string): Promise<Record<string, unknown>>;
    /**
     * Search documents by metadata filters with token-based pagination.
     * Uses Google Drive query API to search by custom properties.
     * Always performed as admin.
     *
     * Example filters:
     * { activity_id: 'act_123', document_type: 'student_copy' }
     *
     * Becomes Google Drive query:
     * "properties has { key='activity_id' and value='act_123' } and
     *  properties has { key='document_type' and value='student_copy' }"
     *
     * @param filters - Metadata key-value filters
     * @param limit - Maximum results per page (default: 20, max: 100)
     * @param pageToken - Token from previous response for next page
     * @returns Search results with documents and next page token
     */
    searchByMetadata(filters: Record<string, unknown>, limit?: number, pageToken?: string): Promise<SearchDocumentsResult>;
    /**
     * Converts a Google Drive file object to the internal Document format.
     *
     * @param file The Google Drive file to convert.
     * @returns The corresponding Document object.
     */
    private _toDocumentObject;
}
