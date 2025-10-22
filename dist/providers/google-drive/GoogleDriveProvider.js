import { ProviderError } from '../../src/types';
import { GoogleAuthHelper } from './auth';
import { DocumentOperations } from './operations';
import { DocumentPermissions } from './permissions';
import { DocumentMetadata } from './metadata';
/**
 * Google Drive Storage Provider implementation.
 *
 * Implements the {@link IStorageProvider} interface for Google Drive.
 * Orchestrates authentication, document operations, permissions, and metadata
 * to provide complete document management functionality.
 */
export class GoogleDriveProvider {
    /**
     * Constructs a new GoogleDriveProvider instance.
     * @param config The configuration object for Google Drive integration.
     */
    constructor(config) {
        this.authHelper = new GoogleAuthHelper(config);
        this.operations = new DocumentOperations(this.authHelper);
        this.permissions = new DocumentPermissions(this.authHelper);
        this.metadata = new DocumentMetadata(this.authHelper);
    }
    // ==================== DOCUMENT OPERATIONS ====================
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
    async copyDocumentFromSource(request) {
        try {
            // 1. Copy document
            const copiedFile = await this.operations.copyDocument(request.source_reference, request.source_owner, request.name);
            // 2. Transfer ownership to admin
            await this.permissions.transferToAdmin(request.source_owner, copiedFile.id);
            // 3. Move to folder (if specified)
            if (request.folder_path) {
                const folderId = await this.operations.createPath(request.folder_path);
                await this.operations.moveToFolder(copiedFile.id, folderId);
            }
            // 4. Set permissions (if specified)
            if (request.access_control && request.access_control.length > 0) {
                await this.permissions.setPermissions(copiedFile.id, request.access_control);
            }
            // 5. Set metadata (if specified)
            if (request.metadata) {
                await this.metadata.setMetadata(copiedFile.id, request.metadata);
            }
            // 6. Transform to Document
            return this._toDocumentObject(copiedFile);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new ProviderError(`Failed to create document: ${errorMessage}`, error);
        }
    }
    /**
     * Retrieves a document's metadata from Google Drive and transforms it into the Document format.
     *
     * @param documentId - The unique identifier of the Google Drive document.
     * @returns The corresponding Document object in the internal format.
     */
    async getDocument(documentId) {
        const file = await this.operations.getDocument(documentId);
        return this._toDocumentObject(file);
    }
    /**
     * Updates a document's name and/or metadata in Google Drive.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - ID of the document to update.
     * @param updates - Object containing the new name and/or metadata to set.
     * @returns The updated Document object.
     */
    async updateDocument(documentId, updates) {
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new ProviderError(`Failed to update document: ${errorMessage}`, error);
        }
    }
    /**
     * Deletes a document permanently by its ID from Google Drive.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - The unique identifier of the document to delete.
     * @returns A promise that resolves when the document is deleted.
     */
    async deleteDocument(documentId) {
        await this.operations.deleteDocument(documentId);
    }
    /**
     * Sets access permissions for a document, replacing all existing non-owner permissions.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - The unique identifier of the document to update permissions for.
     * @param accessControl - Array of AccessControl rules to apply.
     * @returns A promise that resolves when permissions are set.
     */
    async setPermissions(documentId, accessControl) {
        await this.permissions.setPermissions(documentId, accessControl);
    }
    /**
     * Searches for documents by metadata filters in Google Drive.
     * Always performed as admin (who owns all documents).
     *
     * @param filters - Key-value pairs of metadata fields to filter.
     * @param limit - Maximum number of documents to return (default: 20).
     * @param offset - Pagination offset (default: 0).
     * @returns A promise resolving to a SearchDocumentsResult with found documents.
     */
    async searchByMetadata(filters, limit = 20, pageToken) {
        return await this.metadata.searchByMetadata(filters, limit, pageToken);
    }
    /**
     * Retrieves comments for a specific document from Google Drive.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - The unique identifier of the document.
     * @returns A promise resolving to an array of Comment objects.
     */
    async getComments(documentId) {
        return await this.operations.getComments(documentId);
    }
    /**
     * Retrieves revision history for a specific document from Google Drive.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - The unique identifier of the document.
     * @returns A promise resolving to an array of Revision objects.
     */
    async getRevisions(documentId) {
        return await this.operations.getRevisions(documentId);
    }
    // ==================== HELPER METHODS ====================
    /**
     * Converts a Google Drive file object to the internal Document format.
     *
     * @param file The Google Drive file to convert.
     * @returns The corresponding Document object.
     */
    _toDocumentObject(file) {
        // Convert Google Drive properties to metadata
        const metadata = {};
        if (file.properties) {
            for (const [key, value] of Object.entries(file.properties)) {
                if (value !== null && value !== undefined) {
                    // Try to parse JSON values, otherwise keep as string
                    try {
                        metadata[key] = JSON.parse(value);
                    }
                    catch {
                        metadata[key] = value;
                    }
                }
            }
        }
        return {
            document_id: file.id,
            storage_reference: file.id,
            name: file.name || 'Untitled',
            access_url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
            created_at: file.createdTime || new Date().toISOString(),
            updated_at: file.modifiedTime || undefined,
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined
        };
    }
}
//# sourceMappingURL=GoogleDriveProvider.js.map