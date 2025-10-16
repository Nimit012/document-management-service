import { drive_v3 } from 'googleapis';
import { GoogleAuthHelper } from './auth';
import { AccessControl, ProviderError, NotFoundError } from '../../src/types';

/**
 * Helper for Google Drive document operations.
 *
 * Provides core document operations for Google Drive:
 * - Copy documents with ownership transfer
 * - Set and get document permissions
 * - Create and manage folder structures
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
   * Copies a document from the source owner's account.
   *
   * @param sourceDocId Source document ID to copy from.
   * @param sourceOwnerEmail Email of the user who owns/can access the source.
   * @param newName Name for the copied document (optional).
   * @param folderId Parent folder ID (optional).
   * @returns Copied file metadata as a Drive file object.
   * @throws {NotFoundError} If the source document is not found.
   * @throws {ProviderError} If the copy operation fails.
   */
  async copyDocument(
    sourceDocId: string,
    sourceOwnerEmail: string,
    newName?: string,
  ): Promise<drive_v3.Schema$File> {
    try {
      const sourceDriveClient = await this.authHelper.createDriveClient(sourceOwnerEmail);
      
      const copyResponse = await sourceDriveClient.files.copy({
        fileId: sourceDocId,
        requestBody: {
          name: newName,
        },
        fields: 'id,name,webViewLink,createdTime,modifiedTime,mimeType', // return these fields in response
      });
  
      return copyResponse.data;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
        throw new NotFoundError('Document', sourceDocId);
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ProviderError(`Failed to copy document: ${errorMessage}`, error);
    }
  }

  /**
   * Transfers ownership of a document to the admin.
   *
   * @param fileId The ID of the file to transfer ownership of.
   * @throws {ProviderError} If the ownership transfer fails.
   */
  async transferToAdmin(
    sourceOwnerEmail: string,
    fileId: string,
  ): Promise<void> {
    try {
      const adminEmail = this.authHelper.getAdminEmail();
      const sourceDriveClient = await this.authHelper.createDriveClient(sourceOwnerEmail);

      await sourceDriveClient.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'owner',
          type: 'user',
          emailAddress: adminEmail,
        },
        transferOwnership: true,
      });


      const adminDriveClient = await this.authHelper.createAdminDriveClient();
    
      const permissions = await adminDriveClient.permissions.list({
        fileId: fileId,
        fields: 'permissions(id,emailAddress,role)',
      });
  
      // Find teacher's permission
      const teacherPermission = permissions.data.permissions?.find(
        p => p.emailAddress === sourceOwnerEmail
      );
  
      if (teacherPermission?.id) {
        await adminDriveClient.permissions.delete({
          fileId: fileId,
          permissionId: teacherPermission.id,
        });
      }
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ProviderError(`Failed to transfer ownership to admin: ${errorMessage}`, error);
    }
  }

  /**
   * Set permissions on a document
   * Replaces ALL existing permissions except owner
   * Always performed as admin
   * 
   * Flow:
   * 1. Get all existing permissions
   * 2. Delete all non-owner permissions
   * 3. Create new permissions from accessControl array
   * 
   * @param documentId - Document ID
   * @param accessControl - Array of access control rules
   */
  async setPermissions(
    documentId: string,
    accessControl: AccessControl[]
  ): Promise<void> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      // Step 1: Get existing permissions
      console.log(`📋 Getting existing permissions for ${documentId}...`);
      const existingPermissions = await adminDriveClient.permissions.list({
        fileId: documentId,
        fields: 'permissions(id,role,emailAddress,type)',
      });

      const permissions = existingPermissions.data.permissions || [];

      // Step 2: Delete all non-owner permissions
      console.log(`🗑️ Removing ${permissions.length} existing permissions...`);
      for (const permission of permissions) {
        // Never delete owner permission
        if (permission.role === 'owner') {
          console.log(`⏭️ Skipping owner permission: ${permission.emailAddress}`);
          continue;
        }

        if (permission.id) {
          try {
            await adminDriveClient.permissions.delete({
              fileId: documentId,
              permissionId: permission.id,
            });
            console.log(`✅ Removed permission: ${permission.emailAddress} (${permission.role})`);
          } catch (error) {
            console.warn(`⚠️ Failed to remove permission ${permission.id}:`, error);
          }
        }
      }

      // Step 3: Create new permissions
      console.log(`➕ Adding ${accessControl.length} new permissions...`);
      for (const ac of accessControl) {
        const role = this.mapAccessLevelToRole(ac.access_level);

        await adminDriveClient.permissions.create({
          fileId: documentId,
          requestBody: {
            role: role,
            type: 'user',
            emailAddress: ac.user,
          },
          sendNotificationEmail: false, // Don't spam users with emails
        });

        console.log(`✅ Granted ${ac.access_level} access to ${ac.user}`);
      }

      console.log(`✅ Permissions updated successfully`);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ProviderError(
        `Failed to set permissions on document ${documentId}: ${errorMessage}`,
        error
      );
    }
  }

  /**
   * Get current permissions on a document
   * Excludes owner permission
   * Always performed as admin
   * 
   * @param documentId - Document ID
   * @returns Array of access control rules
   */
  async getPermissions(documentId: string): Promise<AccessControl[]> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      const response = await adminDriveClient.permissions.list({
        fileId: documentId,
        fields: 'permissions(id,role,emailAddress,type)',
      });

      const permissions = response.data.permissions || [];

      // Filter out owner and convert to AccessControl format
      const accessControl: AccessControl[] = permissions
        .filter((p) => p.role !== 'owner' && p.emailAddress)
        .map((p) => ({
          user: p.emailAddress!,
          access_level: this.mapRoleToAccessLevel(p.role!),
        }));

      return accessControl;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ProviderError(
        `Failed to get permissions for document ${documentId}: ${errorMessage}`,
        error
      );
    }
  }

  /**
   * Map our access level to Google Drive role
   * 
   * @param accessLevel - Our access level (read, read_write, comment)
   * @returns Google Drive role (reader, writer, commenter)
   */
  private mapAccessLevelToRole(accessLevel: string): string {
    const mapping: Record<string, string> = {
      read: 'reader',
      read_write: 'writer',
      comment: 'commenter',
    };

    const role = mapping[accessLevel];
    if (!role) {
      throw new ProviderError(
        `Invalid access level: ${accessLevel}. Must be read, read_write, or comment`
      );
    }

    return role;
  }

  /**
   * Map Google Drive role to our access level
   * 
   * @param role - Google Drive role (reader, writer, commenter)
   * @returns Our access level (read, read_write, comment)
   */
  private mapRoleToAccessLevel(role: string): 'read' | 'read_write' | 'comment' {
    const mapping: Record<string, 'read' | 'read_write' | 'comment'> = {
      reader: 'read',
      writer: 'read_write',
      commenter: 'comment',
    };

    return mapping[role] || 'read'; // Default to read if unknown
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
        console.log(`📁 Processing folder: ${folderName} (parent: ${parentId || 'root'})`);
        
        parentId = await this.findOrCreateFolder(
          adminDriveClient,
          folderName,
          parentId
        );
        
        console.log(`✅ Folder ready: ${folderName} (id: ${parentId})`);
      }

      console.log(`✅ Complete folder path created: ${path}`);
      return parentId!;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ProviderError(
        `Failed to create folder path "${path}": ${errorMessage}`,
        error
      );
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
  private async findOrCreateFolder(
    drive: drive_v3.Drive,
    folderName: string,
    parentId: string | null
  ): Promise<string> {
    // Step 1: Search for existing folder
    const existingFolder = await this.findFolder(drive, folderName, parentId);

    if (existingFolder) {
      console.log(`  ℹ️ Folder already exists: ${folderName}`);
      return existingFolder;
    }

    // Step 2: Create new folder if not found
    console.log(`  ➕ Creating new folder: ${folderName}`);
    return await this.createFolder(drive, folderName, parentId);
  }

  /**
   * Search for existing folder
   * 
   * @param drive - Authenticated Drive client
   * @param folderName - Folder name to search for
   * @param parentId - Parent folder ID (null for root)
   * @returns Folder ID if found, null otherwise
   */
  private async findFolder(
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
        `trashed=false`,
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
        pageSize: 1, // We only need first match
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
  private async createFolder(
    drive: drive_v3.Drive,
    folderName: string,
    parentId: string | null
  ): Promise<string> {
    const folderMetadata: drive_v3.Schema$File = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    };

    const response = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id,name',
    });

    if (!response.data || !response.data.id) {
      throw new ProviderError(`Failed to create folder: ${folderName}`);
    }

    return response.data.id;
  }




  /**
 * Moves a document to a specific folder.
 * Removes document from all current parent folders and places in new folder.
 * Must be called as the document owner.
 *
 * @param fileId The ID of the file to move.
 * @param folderId The ID of the destination folder.
 * @throws {ProviderError} If the move operation fails.
 */
async moveToFolder(
  fileId: string,
  folderId: string
): Promise<void> {
  try {
    const adminDriveClient = await this.authHelper.createAdminDriveClient();
    
    // Get current parents
    const file = await adminDriveClient.files.get({
      fileId: fileId,
      fields: 'parents',
    });

    const previousParents = file.data.parents?.join(',') || '';

    // Move file to new folder and remove from old parents
    await adminDriveClient.files.update({
      fileId: fileId,
      addParents: folderId,
      removeParents: previousParents,
      fields: 'id,parents',
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new ProviderError(`Failed to move document to folder: ${errorMessage}`, error);
  }
}

}