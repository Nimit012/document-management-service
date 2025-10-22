import { GoogleAuthHelper } from './auth';
import { AccessControl } from '../../src/types';
/**
 * Permission management for Google Drive documents.
 *
 * Handles ownership transfers and permission settings for documents.
 */
export declare class DocumentPermissions {
    /**
     * Helper for Google authentication and impersonation.
     */
    private authHelper;
    /**
     * Constructs a new DocumentPermissions instance.
     * @param authHelper The authentication helper for creating Drive clients.
     */
    constructor(authHelper: GoogleAuthHelper);
    /**
     * Transfers ownership of a document to the admin.
     *
     * @param sourceOwnerEmail Email of the current document owner.
     * @param fileId The ID of the file to transfer ownership of.
     * @throws {ProviderError} If the ownership transfer fails.
     */
    transferToAdmin(sourceOwnerEmail: string, fileId: string): Promise<void>;
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
    setPermissions(documentId: string, accessControl: AccessControl[]): Promise<void>;
    /**
     * Get current permissions on a document
     * Excludes owner permission
     * Always performed as admin
     *
     * @param documentId - Document ID
     * @returns Array of access control rules
     */
    getPermissions(documentId: string): Promise<AccessControl[]>;
    /**
     * Map our access level to Google Drive role
     *
     * @param accessLevel - Our access level (read, read_write, comment)
     * @returns Google Drive role (reader, writer, commenter)
     */
    private _mapAccessLevelToRole;
    /**
     * Map Google Drive role to our access level
     *
     * @param role - Google Drive role (reader, writer, commenter)
     * @returns Our access level (read, read_write, comment)
     */
    private _mapRoleToAccessLevel;
}
