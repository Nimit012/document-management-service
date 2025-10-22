import { drive_v3 } from 'googleapis';
import { GoogleAuthHelper } from './auth';
import { Comment, Revision } from '../../src/types';
/**
 * Helper for Google Drive document operations.
 *
 * This class provides comprehensive document management capabilities for Google Drive:
 *  - Copy documents between users with ownership transfer
 *  - Set and retrieve document permissions (read, write, comment access)
 *  - Create nested folder structures and manage folder hierarchy
 *  - Move documents between folders
 *  - Handle authentication and impersonation for multi-user operations
 *
 * All operations are performed using Google Drive API v3 with proper error handling
 * and support for domain-wide delegation to manage documents across user accounts.
 */
export declare class DocumentOperations {
    private authHelper;
    /**
     * Creates a new DocumentOperations instance.
     * @param authHelper The GoogleAuthHelper used for authentication and impersonation.
     */
    constructor(authHelper: GoogleAuthHelper);
    /**
     * Copies a document from the source owner's account.
     *
     * @param sourceDocId Source document ID to copy from.
     * @param sourceOwnerEmail Email of the user who owns/can access the source.
     * @param newName Name for the copied document (optional).
     * @returns Copied file metadata as a Drive file object.
     * @throws {NotFoundError} If the source document is not found.
     * @throws {ProviderError} If the copy operation fails.
     */
    copyDocument(sourceDocId: string, sourceOwnerEmail: string, newName?: string): Promise<drive_v3.Schema$File>;
    /**
     * Get document metadata
     * Always performed as admin
     *
     * @param documentId - Document ID
     * @returns Document metadata
     */
    getDocument(documentId: string): Promise<drive_v3.Schema$File>;
    /**
     * Update document name
     * Always performed as admin
     *
     * @param documentId - Document ID
     * @param newName - New document name
     */
    updateName(documentId: string, newName: string): Promise<void>;
    /**
     * Delete document permanently
     * Always performed as admin
     *
     * @param documentId - Document ID
     */
    deleteDocument(documentId: string): Promise<void>;
    /**
     * Create nested folder path
     *
     * Example: "us_history2/unit1/masters"
     * Creates:
     * - us_history2/ (if doesn't exist)
     * - us_history2/unit1/ (if doesn't exist)
     * - us_history2/unit1/masters/ (if doesn't exist)
     *
     * Returns: ID of the final folder (masters)
     *
     * Always performed as admin
     *
     * @param path - Folder path (e.g., "course/unit1/masters")
     * @returns ID of final folder in path
     */
    createPath(path: string): Promise<string>;
    /**
     * Find existing folder or create new one
     *
     * @param drive - Authenticated Drive client
     * @param folderName - Name of folder to find/create
     * @param parentId - Parent folder ID (null for root)
     * @returns Folder ID
     */
    private _findOrCreateFolder;
    /**
     * Search for existing folder
     *
     * @param drive - Authenticated Drive client
     * @param folderName - Folder name to search for
     * @param parentId - Parent folder ID (null for root)
     * @returns Folder ID if found, null otherwise
     */
    private _findFolder;
    /**
     * Create new folder
     *
     * @param drive - Authenticated Drive client
     * @param folderName - Name for new folder
     * @param parentId - Parent folder ID (null for root)
     * @returns New folder ID
     */
    private _createFolder;
    /**
     * Moves a document to a specific folder.
     * Removes document from all current parent folders and places in new folder.
     * Always performed as admin.
     *
     * @param fileId The ID of the file to move.
     * @param folderId The ID of the destination folder.
     * @throws {ProviderError} If the move operation fails.
     */
    moveToFolder(fileId: string, folderId: string): Promise<void>;
    /**
     * Retrieves comments for a document from Google Drive.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - The unique identifier of the document.
     * @returns A promise resolving to an array of Comment objects.
     * @throws {NotFoundError} If the document is not found.
     * @throws {ProviderError} If the operation fails.
     */
    getComments(documentId: string): Promise<Comment[]>;
    /**
     * Retrieves revisions for a document from Google Drive.
     * Always performed as admin (who owns all documents).
     *
     * @param documentId - The unique identifier of the document.
     * @returns A promise resolving to an array of Revision objects.
     * @throws {NotFoundError} If the document is not found.
     * @throws {ProviderError} If the operation fails.
     */
    getRevisions(documentId: string): Promise<Revision[]>;
}
