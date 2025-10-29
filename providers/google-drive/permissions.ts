import { GoogleAuthHelper } from './auth';
import {AccessControl, ProviderError, NotFoundError, PermissionError } from '../../src/types';

/**
 * Permission management for Google Drive documents.
 *
 * Handles ownership transfers and permission settings for documents.
 */
export class DocumentPermissions {
  /**
   * Helper for Google authentication and impersonation.
   */
  private authHelper: GoogleAuthHelper;

  /**
   * Constructs a new DocumentPermissions instance.
   * @param authHelper The authentication helper for creating Drive clients.
   */
  constructor(authHelper: GoogleAuthHelper) {
    this.authHelper = authHelper;
  }

  /**
   * Transfers ownership of a document to the admin.
   *
   * @param sourceOwnerEmail Email of the current document owner (optional, skips transfer if not provided).
   * @param fileId The ID of the file to transfer ownership of.
   * @throws {ProviderError} If the ownership transfer fails.
   * @throws {PermissionError} If there are permission issues during transfer.
   * @throws {NotFoundError} If the document is not found.
   */
  async transferToAdmin(sourceOwnerEmail: string | undefined, fileId: string): Promise<void> {
    try {
      // Skip ownership transfer if sourceOwnerEmail is not provided (document already owned by admin)
      if (!sourceOwnerEmail) {
        return;
      }

      const adminEmail = this.authHelper.getAdminEmail();
      const sourceDriveClient = await this.authHelper.createDriveClient(sourceOwnerEmail);

      await sourceDriveClient.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'owner',
          type: 'user',
          emailAddress: adminEmail
        },
        transferOwnership: true
      });

      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      const permissions = await adminDriveClient.permissions.list({
        fileId: fileId,
        fields: 'permissions(id,emailAddress,role)'
      });

      // Find teacher's permission
      const teacherPermission = permissions.data.permissions?.find(
        (p) => p.emailAddress === sourceOwnerEmail
      );

      if (teacherPermission?.id) {
        await adminDriveClient.permissions.delete({
          fileId: fileId,
          permissionId: teacherPermission.id
        });
      }
    } catch (error: unknown) {
      this._handleError(error, fileId, 'transfer ownership to admin');
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
   * @throws {PermissionError} If permission operations fail due to authorization issues.
   * @throws {NotFoundError} If the document is not found.
   * @throws {ProviderError} If the operation fails for other reasons.
   */
  async setPermissions(documentId: string, accessControl: AccessControl[]): Promise<void> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      // Step 1: Get existing permissions
      const existingPermissions = await adminDriveClient.permissions.list({
        fileId: documentId,
        fields: 'permissions(id,role,emailAddress,type)'
      });

      const permissions = existingPermissions.data.permissions || [];

      // Step 2: Delete all non-owner permissions
      for (const permission of permissions) {
        // Never delete owner permission
        if (permission.role === 'owner') {
          continue;
        }

        if (permission.id) {
          try {
            await adminDriveClient.permissions.delete({
              fileId: documentId,
              permissionId: permission.id
            });
          } catch (error) {
            console.warn(`Failed to remove permission ${permission.id}:`, error);
          }
        }
      }

      // Step 3: Create new permissions
      for (const ac of accessControl) {
        const role = this._mapAccessLevelToRole(ac.access_level);

        try {
          await adminDriveClient.permissions.create({
            fileId: documentId,
            requestBody: {
              role: role,
              type: 'user',
              emailAddress: ac.user
            },
            sendNotificationEmail: false // Don't spam users with emails
          });
        } catch (error) {
          // Check for permission-specific errors during permission creation
          if (error && typeof error === 'object' && 'code' in error && error.code === 403) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new PermissionError(
              `Failed to grant ${ac.access_level} access to user ${ac.user} on document ${documentId}: ${errorMessage}`
            );
          }
          throw error; // Re-throw other errors to be handled by outer catch
        }
      }

    } catch (error: unknown) {
      this._handleError(error, documentId, 'set permissions on document');
    }
  }

  /**
   * Get current permissions on a document
   * Excludes owner permission
   * Always performed as admin
   *
   * @param documentId - Document ID
   * @returns Array of access control rules
   * @throws {PermissionError} If there are permission issues accessing the document.
   * @throws {NotFoundError} If the document is not found.
   * @throws {ProviderError} If the operation fails for other reasons.
   */
  async getPermissions(documentId: string): Promise<AccessControl[]> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      const response = await adminDriveClient.permissions.list({
        fileId: documentId,
        fields: 'permissions(id,role,emailAddress,type)'
      });

      const permissions = response.data.permissions || [];

      // Filter out owner and convert to AccessControl format
      const accessControl: AccessControl[] = permissions
        .filter((p) => p.role !== 'owner' && p.emailAddress)
        .map((p) => ({
          user: p.emailAddress!,
          access_level: this._mapRoleToAccessLevel(p.role!)
        }));

      return accessControl;
    } catch (error: unknown) {
      this._handleError(error, documentId, 'get permissions for document');
    }
  }

  /**
   * Map our access level to Google Drive role
   *
   * @param accessLevel - Our access level (read, read_write, comment)
   * @returns Google Drive role (reader, writer, commenter)
   */
  private _mapAccessLevelToRole(accessLevel: string): string {
    const mapping: Record<string, string> = {
      read: 'reader',
      read_write: 'writer',
      comment: 'commenter'
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
  private _mapRoleToAccessLevel(role: string): 'read' | 'read_write' | 'comment' {
    const mapping: Record<string, 'read' | 'read_write' | 'comment'> = {
      reader: 'read',
      writer: 'read_write',
      commenter: 'comment'
    };

    return mapping[role] || 'read'; // Default to read if unknown
  }

  /**
   * Centralized error handling for permission operations.
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
