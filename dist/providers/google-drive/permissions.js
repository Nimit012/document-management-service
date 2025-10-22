import { ProviderError, NotFoundError } from '../../src/types';
/**
 * Permission management for Google Drive documents.
 *
 * Handles ownership transfers and permission settings for documents.
 */
export class DocumentPermissions {
    /**
     * Constructs a new DocumentPermissions instance.
     * @param authHelper The authentication helper for creating Drive clients.
     */
    constructor(authHelper) {
        this.authHelper = authHelper;
    }
    /**
     * Transfers ownership of a document to the admin.
     *
     * @param sourceOwnerEmail Email of the current document owner.
     * @param fileId The ID of the file to transfer ownership of.
     * @throws {ProviderError} If the ownership transfer fails.
     */
    async transferToAdmin(sourceOwnerEmail, fileId) {
        try {
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
            const teacherPermission = permissions.data.permissions?.find((p) => p.emailAddress === sourceOwnerEmail);
            if (teacherPermission?.id) {
                await adminDriveClient.permissions.delete({
                    fileId: fileId,
                    permissionId: teacherPermission.id
                });
            }
        }
        catch (error) {
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
    async setPermissions(documentId, accessControl) {
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
                    }
                    catch (error) {
                        console.warn(`Failed to remove permission ${permission.id}:`, error);
                    }
                }
            }
            // Step 3: Create new permissions
            for (const ac of accessControl) {
                const role = this._mapAccessLevelToRole(ac.access_level);
                await adminDriveClient.permissions.create({
                    fileId: documentId,
                    requestBody: {
                        role: role,
                        type: 'user',
                        emailAddress: ac.user
                    },
                    sendNotificationEmail: false // Don't spam users with emails
                });
            }
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
                throw new NotFoundError('Document', documentId);
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new ProviderError(`Failed to set permissions on document ${documentId}: ${errorMessage}`, error);
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
    async getPermissions(documentId) {
        try {
            const adminDriveClient = await this.authHelper.createAdminDriveClient();
            const response = await adminDriveClient.permissions.list({
                fileId: documentId,
                fields: 'permissions(id,role,emailAddress,type)'
            });
            const permissions = response.data.permissions || [];
            // Filter out owner and convert to AccessControl format
            const accessControl = permissions
                .filter((p) => p.role !== 'owner' && p.emailAddress)
                .map((p) => ({
                user: p.emailAddress,
                access_level: this._mapRoleToAccessLevel(p.role)
            }));
            return accessControl;
        }
        catch (error) {
            if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
                throw new NotFoundError('Document', documentId);
            }
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            throw new ProviderError(`Failed to get permissions for document ${documentId}: ${errorMessage}`, error);
        }
    }
    /**
     * Map our access level to Google Drive role
     *
     * @param accessLevel - Our access level (read, read_write, comment)
     * @returns Google Drive role (reader, writer, commenter)
     */
    _mapAccessLevelToRole(accessLevel) {
        const mapping = {
            read: 'reader',
            read_write: 'writer',
            comment: 'commenter'
        };
        const role = mapping[accessLevel];
        if (!role) {
            throw new ProviderError(`Invalid access level: ${accessLevel}. Must be read, read_write, or comment`);
        }
        return role;
    }
    /**
     * Map Google Drive role to our access level
     *
     * @param role - Google Drive role (reader, writer, commenter)
     * @returns Our access level (read, read_write, comment)
     */
    _mapRoleToAccessLevel(role) {
        const mapping = {
            reader: 'read',
            writer: 'read_write',
            commenter: 'comment'
        };
        return mapping[role] || 'read'; // Default to read if unknown
    }
}
