import { drive_v3 } from 'googleapis';
import { GoogleDriveConfig } from '../../src/types';
/**
 * Google authentication helper for Drive API operations.
 *
 * Handles authentication and client creation for the Google Drive API
 * using a service account with domain-wide delegation.
 *
 * Key concept: The service account can impersonate any user in the domain
 * by setting the 'subject' field in the clientOptions.
 */
export declare class GoogleAuthHelper {
    /**
     * The service account key used for authentication.
     */
    private serviceAccountKey;
    /**
     * The admin email address for the domain.
     */
    private adminEmail;
    /**
     * OAuth scopes required for Drive API access.
     */
    private scopes;
    /**
     * Cache for Drive API client instances per impersonated user.
     */
    private driveClientCache;
    /**
     * Constructs a new GoogleAuthHelper instance.
     * @param config Google Drive configuration with service account credentials.
     */
    constructor(config: GoogleDriveConfig);
    /**
     * Validates that the service account key contains all required fields.
     * @throws {ProviderError} If required fields are missing.
     */
    private validateServiceAccountKey;
    /**
     * Creates a GoogleAuth client that impersonates a specific user.
     *
     * Domain-wide delegation steps:
     * - Service account authenticates as itself.
     * - Acts as the specified user (subject).
     * - All API calls appear to come from that user.
     *
     * @param impersonateEmail Email of the user to impersonate.
     * @returns Authenticated GoogleAuth client.
     * @throws {ProviderError} If the client cannot be created.
     */
    private createAuthClient;
    /**
     * Creates an authenticated Google Drive API client for the impersonated user.
     *
     * All API calls will be made as the impersonated user.
     *
     * @param impersonateEmail Email of the user to impersonate.
     * @returns Google Drive v3 API client.
     * @throws {ProviderError} If the client cannot be created.
     */
    createDriveClient(impersonateEmail: string): Promise<drive_v3.Drive>;
    /**
     * Returns the admin email for the domain.
     * @returns The admin email address.
     */
    getAdminEmail(): string;
    /**
     * Creates an authenticated Google Drive API client for the admin user.
     *
     * This is a convenience method that automatically uses the admin email
     * configured during initialization.
     *
     * @returns Google Drive v3 API client authenticated as admin.
     */
    createAdminDriveClient(): Promise<drive_v3.Drive>;
}
