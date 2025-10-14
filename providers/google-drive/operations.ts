import { drive_v3 } from 'googleapis';
import { GoogleAuthHelper } from './auth';
import { ProviderError, NotFoundError } from '../../src/types';

/**
 * Document Operations Helper
 * 
 * Handles core document operations for Google Drive:
 * - Copy documents with ownership transfer
 * - Get document metadata
 * - Update document names
 * - Delete documents
 */
export class DocumentOperations {
  constructor(private authHelper: GoogleAuthHelper) {}

  /**
   * Copy document with ownership transfer
   * 
   * This is the two-step process:
   * 1. Impersonate source owner to copy their document
   * 2. Impersonate admin to transfer ownership
   * 
   * @param sourceDocId - Source document ID to copy from
   * @param sourceOwnerEmail - Email of user who owns/can access source
   * @param newName - Name for the copied document (optional)
   * @param folderId - Parent folder ID (optional)
   * @returns Copied file metadata
   */
  async copyWithOwnershipTransfer(
    sourceDocId: string,
    sourceOwnerEmail: string,
    newName?: string,
    folderId?: string
  ): Promise<drive_v3.Schema$File> {
    try {
      // Step 1: Impersonate source owner and copy document
      console.log(`📋 Copying document as ${sourceOwnerEmail}...`);
      const sourceDrive = this.authHelper.createDriveClient(sourceOwnerEmail);

      const copyRequestBody: drive_v3.Schema$File = {
        name: newName,
        parents: folderId ? [folderId] : undefined,
      };

      const copyResponse = await sourceDrive.files.copy({
        fileId: sourceDocId,
        requestBody: copyRequestBody,
        fields: 'id,name,webViewLink,createdTime,modifiedTime,mimeType',
      });

      if (!copyResponse.data || !copyResponse.data.id) {
        throw new ProviderError('Copy operation failed - no file ID returned');
      }

      const copiedFileId = copyResponse.data.id;
      console.log(`✅ Document copied: ${copiedFileId}`);

      // Step 2: Impersonate admin and transfer ownership
      const adminEmail = this.authHelper.getAdminEmail();
      
      // Only transfer if source owner is not admin
      if (sourceOwnerEmail !== adminEmail) {
        console.log(`👑 Transferring ownership to ${adminEmail}...`);
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

        console.log(`✅ Ownership transferred to admin`);
      } else {
        console.log(`ℹ️ Source owner is admin, no transfer needed`);
      }

      return copyResponse.data;
    } catch (error: any) {
      if (error.code === 404) {
        throw new NotFoundError('Document', sourceDocId);
      }
      throw new ProviderError(
        `Failed to copy document ${sourceDocId}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get document metadata
   * Always performed as admin
   * 
   * @param documentId - Document ID
   * @returns Document metadata
   */
  async getDocument(documentId: string): Promise<drive_v3.Schema$File> {
    try {
      const adminEmail = this.authHelper.getAdminEmail();
      const adminDrive = this.authHelper.createDriveClient(adminEmail);

      const response = await adminDrive.files.get({
        fileId: documentId,
        fields: 'id,name,webViewLink,createdTime,modifiedTime,mimeType,properties',
      });

      if (!response.data) {
        throw new NotFoundError('Document', documentId);
      }

      return response.data;
    } catch (error: any) {
      if (error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      throw new ProviderError(
        `Failed to get document ${documentId}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Update document name
   * Always performed as admin
   * 
   * @param documentId - Document ID
   * @param newName - New document name
   */
  async updateName(documentId: string, newName: string): Promise<void> {
    try {
      const adminEmail = this.authHelper.getAdminEmail();
      const adminDrive = this.authHelper.createDriveClient(adminEmail);

      await adminDrive.files.update({
        fileId: documentId,
        requestBody: {
          name: newName,
        },
      });

      console.log(`✅ Document name updated: ${newName}`);
    } catch (error: any) {
      if (error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      throw new ProviderError(
        `Failed to update document name ${documentId}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Delete document permanently
   * Always performed as admin
   * 
   * @param documentId - Document ID
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      const adminEmail = this.authHelper.getAdminEmail();
      const adminDrive = this.authHelper.createDriveClient(adminEmail);

      await adminDrive.files.delete({
        fileId: documentId,
      });

      console.log(`🗑️ Document deleted: ${documentId}`);
    } catch (error: any) {
      if (error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      throw new ProviderError(
        `Failed to delete document ${documentId}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Get document's web view link
   * 
   * @param documentId - Document ID
   * @returns Web view link URL
   */
  async getWebViewLink(documentId: string): Promise<string> {
    const doc = await this.getDocument(documentId);
    return doc.webViewLink || `https://docs.google.com/document/d/${documentId}/edit`;
  }
}