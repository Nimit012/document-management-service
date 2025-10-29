import { drive_v3 } from 'googleapis';
import { GoogleAuthHelper } from './auth';
import { ProviderError, NotFoundError, PermissionError, Comment, Revision } from '../../src/types';

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
export class DocumentOperations {
  /**
   * Creates a new DocumentOperations instance.
   * @param authHelper The GoogleAuthHelper used for authentication and impersonation.
   */
  constructor(private authHelper: GoogleAuthHelper) {}

  /**
   * Copies a document from the source owner's account.
   *
   * @param sourceDocId Source document ID to copy from.
   * @param sourceOwnerEmail Email of the user who owns/can access the source (optional, uses admin if not provided).
   * @param newName Name for the copied document (optional).
   * @returns Copied file metadata as a Drive file object.
   * @throws {NotFoundError} If the source document is not found.
   * @throws {PermissionError} If there are permission issues accessing the source document.
   * @throws {ProviderError} If the copy operation fails.
   */
  async copyDocument(
    sourceDocId: string,
    sourceOwnerEmail?: string,
    newName?: string
  ): Promise<drive_v3.Schema$File> {
    try {
      // Use admin drive client if sourceOwnerEmail is not provided
      const sourceDriveClient = sourceOwnerEmail 
        ? await this.authHelper.createDriveClient(sourceOwnerEmail)
        : await this.authHelper.createAdminDriveClient();

      const copyResponse = await sourceDriveClient.files.copy({
        fileId: sourceDocId,
        requestBody: {
          name: newName
        },
        fields: 'id,name,webViewLink,createdTime,modifiedTime,mimeType' // return these fields in response
      });

      return copyResponse.data;
    } catch (error: unknown) {
      this._handleError(error, sourceDocId, 'copy document');
    }
  }

  /**
   * Get document metadata
   * Always performed as admin
   *
   * @param documentId - Document ID
   * @returns Document metadata
   * @throws {NotFoundError} If the document is not found.
   * @throws {PermissionError} If there are permission issues accessing the document.
   * @throws {ProviderError} If the operation fails for other reasons.
   */
  async getDocument(documentId: string): Promise<drive_v3.Schema$File> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      const response = await adminDriveClient.files.get({
        fileId: documentId,
        fields: 'id,name,webViewLink,createdTime,modifiedTime,mimeType,properties'
      });

      if (!response.data) {
        throw new NotFoundError('Document', documentId);
      }

      return response.data;
    } catch (error: unknown) {
      this._handleError(error, documentId, 'get document');
    }
  }

  /**
   * Update document name
   * Always performed as admin
   *
   * @param documentId - Document ID
   * @param newName - New document name
   * @throws {NotFoundError} If the document is not found.
   * @throws {PermissionError} If there are permission issues updating the document.
   * @throws {ProviderError} If the operation fails for other reasons.
   */
  async updateName(documentId: string, newName: string): Promise<void> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      await adminDriveClient.files.update({
        fileId: documentId,
        requestBody: {
          name: newName
        }
      });

    } catch (error: unknown) {
      this._handleError(error, documentId, 'update document name');
    }
  }

  /**
   * Delete document permanently
   * Always performed as admin
   *
   * @param documentId - Document ID
   * @throws {NotFoundError} If the document is not found.
   * @throws {PermissionError} If there are permission issues deleting the document.
   * @throws {ProviderError} If the operation fails for other reasons.
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      await adminDriveClient.files.delete({
        fileId: documentId
      });

    } catch (error: unknown) {
      this._handleError(error, documentId, 'delete document');
    }
  }

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
  async createPath(path: string): Promise<string> {
    try {
      // Clean up path (remove leading/trailing slashes, empty segments)
      const segments = path
        .split('/')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (segments.length === 0) {
        throw new ProviderError('Folder path cannot be empty');
      }

      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      let parentId: string | null = null;

      // Create each folder in the path
      for (const folderName of segments) {

        parentId = await this._findOrCreateFolder(adminDriveClient, folderName, parentId);

      }

      return parentId!;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ProviderError(`Failed to create folder path "${path}": ${errorMessage}`, error);
    }
  }

  /**
   * Find existing folder or create new one
   *
   * @param drive - Authenticated Drive client
   * @param folderName - Name of folder to find/create
   * @param parentId - Parent folder ID (null for root)
   * @returns Folder ID
   */
  private async _findOrCreateFolder(
    drive: drive_v3.Drive,
    folderName: string,
    parentId: string | null
  ): Promise<string> {
    // Step 1: Search for existing folder
    const existingFolder = await this._findFolder(drive, folderName, parentId);

    if (existingFolder) {
      return existingFolder;
    }

    // Step 2: Create new folder if not found
    return await this._createFolder(drive, folderName, parentId);
  }

  /**
   * Search for existing folder
   *
   * @param drive - Authenticated Drive client
   * @param folderName - Folder name to search for
   * @param parentId - Parent folder ID (null for root)
   * @returns Folder ID if found, null otherwise
   */
  private async _findFolder(
    drive: drive_v3.Drive,
    folderName: string,
    parentId: string | null
  ): Promise<string | null> {
    try {
      // Escape single quotes in folder name
      const escapedName = folderName.replace(/'/g, "\\'");

      // Build query
      const queryParts = [
        `name='${escapedName}'`,
        `mimeType='application/vnd.google-apps.folder'`,
        `trashed=false`
      ];

      // Add parent condition
      if (parentId) {
        queryParts.push(`'${parentId}' in parents`);
      } else {
        // Search in root (My Drive)
        queryParts.push(`'root' in parents`);
      }

      const query = queryParts.join(' and ');

      const response = await drive.files.list({
        q: query,
        fields: 'files(id,name)',
        pageSize: 1 // We only need first match
      });

      const folders = response.data.files || [];

      if (folders.length > 0) {
        return folders[0].id!;
      }

      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`  ⚠️ Error searching for folder ${folderName}:`, errorMessage);
      return null; // If search fails, we'll create it
    }
  }

  /**
   * Create new folder
   *
   * @param drive - Authenticated Drive client
   * @param folderName - Name for new folder
   * @param parentId - Parent folder ID (null for root)
   * @returns New folder ID
   */
  private async _createFolder(
    drive: drive_v3.Drive,
    folderName: string,
    parentId: string | null
  ): Promise<string> {
    const folderMetadata: drive_v3.Schema$File = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined
    };

    const response = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id,name'
    });

    if (!response.data || !response.data.id) {
      throw new ProviderError(`Failed to create folder: ${folderName}`);
    }

    return response.data.id;
  }

  /**
   * Moves a document to a specific folder.
   * Removes document from all current parent folders and places in new folder.
   * Always performed as admin.
   *
   * @param fileId The ID of the file to move.
   * @param folderId The ID of the destination folder.
   * @throws {NotFoundError} If the document or folder is not found.
   * @throws {PermissionError} If there are permission issues moving the document.
   * @throws {ProviderError} If the move operation fails for other reasons.
   */
  async moveToFolder(fileId: string, folderId: string): Promise<void> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      // Get current parents
      const file = await adminDriveClient.files.get({
        fileId: fileId,
        fields: 'parents'
      });

      const previousParents = file.data.parents?.join(',') || '';

      // Move file to new folder and remove from old parents
      await adminDriveClient.files.update({
        fileId: fileId,
        addParents: folderId,
        removeParents: previousParents,
        fields: 'id,parents'
      });
    } catch (error: unknown) {
      this._handleError(error, fileId, 'move document to folder');
    }
  }

  /**
   * Retrieves comments for a document from Google Drive.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document.
   * @returns A promise resolving to an array of Comment objects.
   * @throws {NotFoundError} If the document is not found.
   * @throws {PermissionError} If there are permission issues accessing comments.
   * @throws {ProviderError} If the operation fails for other reasons.
   */
  async getComments(documentId: string): Promise<Comment[]> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      const response = await adminDriveClient.comments.list({
        fileId: documentId,
        fields: 'comments(id,content,author,createdTime,resolved,replies)'
      });

      const comments = response.data.comments || [];

      return comments.map((comment) => ({
        comment_id: comment.id!,
        author: comment.author?.displayName  || 'Unknown',
        content: comment.content!,
        created_at: comment.createdTime!,
        resolved: comment.resolved || false,
        replies: (comment.replies || []).map((reply) => ({
          reply_id: reply.id!,
          author: reply.author?.displayName  || 'Unknown',
          content: reply.content!,
          created_at: reply.createdTime!
        }))
      }));
    } catch (error: unknown) {
      this._handleError(error, documentId, 'get comments for document');
    }
  }

  /**
   * Retrieves revisions for a document from Google Drive.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document.
   * @returns A promise resolving to an array of Revision objects.
   * @throws {NotFoundError} If the document is not found.
   * @throws {PermissionError} If there are permission issues accessing revisions.
   * @throws {ProviderError} If the operation fails for other reasons.
   */
  async getRevisions(documentId: string): Promise<Revision[]> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      const response = await adminDriveClient.revisions.list({
        fileId: documentId,
        fields: 'revisions(id,modifiedTime,lastModifyingUser,exportLinks)'
      });

      const revisions = response.data.revisions || [];

      return revisions.map((rev) => ({
        revision_id: rev.id!,
        modified_time: rev.modifiedTime!,
        modified_by: rev.lastModifyingUser?.emailAddress || 'Unknown',
        export_links: rev.exportLinks || undefined
      }));
    } catch (error: unknown) {
      this._handleError(error, documentId, 'get revisions for document');
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Centralized error handling for document operations.
   * Distinguishes between different error types and throws appropriate errors.
   *
   * @param error - The caught error
   * @param documentId - The document ID related to the error
   * @param operation - Description of the operation that failed
   * @throws {PermissionError} For 403 Forbidden errors
   * @throws {NotFoundError} For 404 Not Found errors
   * @throws {ProviderError} For all other errors
   */
  private _handleError(error: unknown, documentId: string, operation: string): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for NotFoundError first (before checking error code)
    if (error instanceof NotFoundError) {
      throw error;
    }

    if (error && typeof error === 'object' && 'code' in error) {
      // Handle HTTP status codes
      if (error.code === 403) {
        throw new PermissionError(
          `Permission denied: Failed to ${operation} ${documentId}. ${errorMessage}`
        );
      }
      if (error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
    }

    // Default to ProviderError for all other errors
    throw new ProviderError(`Failed to ${operation} ${documentId}: ${errorMessage}`, error);
  }
}
