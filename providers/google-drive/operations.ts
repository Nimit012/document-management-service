import { drive_v3 } from 'googleapis';
import { GoogleAuthHelper } from './auth';
import { ProviderError, NotFoundError } from '../../src/types';

/**
 * Helper for Google Drive document operations.
 *
 * Provides core document operations for Google Drive:
 * - Copy documents with ownership transfer
 * - Get document metadata
 * - Update document names
 * - Delete documents
 */
export class DocumentOperations {
  /**
   * Creates a new DocumentOperations instance.
   * @param authHelper The GoogleAuthHelper used for authentication and impersonation.
   */
  constructor(private authHelper: GoogleAuthHelper) {}

  /**
   * Copies a document and transfers ownership to the admin.
   *
   * Two-step process:
   * 1. Impersonate the source owner to copy their document.
   * 2. Impersonate the admin to transfer ownership.
   *
   * @param sourceDocId Source document ID to copy from.
   * @param sourceOwnerEmail Email of the user who owns/can access the source.
   * @param newName Name for the copied document (optional).
   * @param folderId Parent folder ID (optional).
   * @returns Copied file metadata as a Drive file object.
   * @throws {NotFoundError} If the source document is not found.
   * @throws {ProviderError} If the copy or transfer fails.
   */
  async copyDocument(
    sourceDocId: string,
    sourceOwnerEmail: string,
    newName?: string,
    folderId?: string
  ): Promise<drive_v3.Schema$File> {
    try {
      const sourceDrive = this.authHelper.createDriveClient(sourceOwnerEmail);
      
      const copyResponse = await sourceDrive.files.copy({
        fileId: sourceDocId,
        requestBody: {
          name: newName,
          parents: folderId ? [folderId] : undefined,
        },
        fields: 'id,name,webViewLink,createdTime,modifiedTime,mimeType', // return these fields in response
      });
  
      const copiedFileId = copyResponse.data.id!;
  
      // Transfer ownership if needed
      const adminEmail = this.authHelper.getAdminEmail();
      if (sourceOwnerEmail !== adminEmail) {
        const adminDrive = this.authHelper.createDriveClient(adminEmail);
        await adminDrive.permissions.create({
          fileId: copiedFileId,
          requestBody: {
            role: 'owner',
            type: 'user',
            emailAddress: adminEmail,
          },
          transferOwnership: true,
        });
      }
  
      return copyResponse.data;
    } catch (error: any) {
      if (error.code === 404) throw new NotFoundError('Document', sourceDocId);
      throw new ProviderError(`Failed to copy document: ${error.message}`, error);
    }
  }
}