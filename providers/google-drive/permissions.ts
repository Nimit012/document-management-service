import { drive_v3 } from 'googleapis';
import { GoogleAuthHelper } from './auth';
import { AccessControl, ProviderError, NotFoundError } from '../../src/types';

/**
 * Permissions Manager
 * 
 * Handles access control for Google Drive documents:
 * - Set permissions (replaces all non-owner permissions)
 * - Get current permissions
 * - Map access levels to Google Drive roles
 */
export class PermissionsManager {
  constructor(private authHelper: GoogleAuthHelper) {}

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
      const adminEmail = this.authHelper.getAdminEmail();
      const adminDrive = this.authHelper.createDriveClient(adminEmail);

      // Step 1: Get existing permissions
      console.log(`📋 Getting existing permissions for ${documentId}...`);
      const existingPermissions = await adminDrive.permissions.list({
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
            await adminDrive.permissions.delete({
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

        await adminDrive.permissions.create({
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
    } catch (error: any) {
      if (error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      throw new ProviderError(
        `Failed to set permissions on document ${documentId}: ${error.message}`,
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
      const adminEmail = this.authHelper.getAdminEmail();
      const adminDrive = this.authHelper.createDriveClient(adminEmail);

      const response = await adminDrive.permissions.list({
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
    } catch (error: any) {
      if (error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      throw new ProviderError(
        `Failed to get permissions for document ${documentId}: ${error.message}`,
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
}