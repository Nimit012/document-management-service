import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { drive_v3 } from 'googleapis';
import { GoogleDriveConfig, ServiceAccountKey, ProviderError, PermissionError } from '../../src/types';

/**
 * Google authentication helper for Drive API operations.
 *
 * Handles authentication and client creation for the Google Drive API
 * using a service account with domain-wide delegation.
 *
 * Key concept: The service account can impersonate any user in the domain
 * by setting the 'subject' field in the clientOptions.
 */
export class GoogleAuthHelper {
  /**
   * The service account key used for authentication.
   */
  private serviceAccountKey: ServiceAccountKey;

  /**
   * The admin email address for the domain.
   */
  private adminEmail: string;

  /**
   * OAuth scopes required for Drive API access.
   */
  private scopes: string[];

  /**
   * Cache for Drive API client instances per impersonated user.
   */
  private driveClientCache: Map<string, drive_v3.Drive>;

  /**
   * Constructs a new GoogleAuthHelper instance.
   * @param config Google Drive configuration with service account credentials.
   */
  constructor(config: GoogleDriveConfig) {
    this.serviceAccountKey = config.serviceAccountKey;
    this.adminEmail = config.adminEmail;

    // Define OAuth scopes for required permissions
    this.scopes = [
      'https://www.googleapis.com/auth/drive', // Full Drive access
    ];

    // Initialize the Drive client cache
    this.driveClientCache = new Map();

    // Validate service account key structure
    this.validateServiceAccountKey();
  }

  /**
   * Validates that the service account key contains all required fields.
   * @throws {ProviderError} If required fields are missing.
   */
  private validateServiceAccountKey(): void {
    const required: (keyof ServiceAccountKey)[] = ['client_email', 'private_key'];
    const missing = required.filter(field => !this.serviceAccountKey[field]);

    if (missing.length > 0) {
      throw new ProviderError(
        `Service account key is missing required fields: ${missing.join(', ')}`,
      );
    }
  }

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
   * @throws {ProviderError} If the client cannot be created due to configuration issues.
   * @throws {PermissionError} If domain-wide delegation is not properly configured.
   */
  private createAuthClient(impersonateEmail: string): GoogleAuth {
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: this.serviceAccountKey,
        scopes: this.scopes,
        clientOptions: {
          subject: impersonateEmail, // Impersonation
        },
      });

      return auth;
    } catch (error) {
      this._handleAuthError(error, impersonateEmail);
    }
  }

  /**
   * Creates an authenticated Google Drive API client for the impersonated user.
   *
   * All API calls will be made as the impersonated user.
   *
   * @param impersonateEmail Email of the user to impersonate.
   * @returns Google Drive v3 API client.
   * @throws {ProviderError} If the client cannot be created.
   * @throws {PermissionError} If authentication/authorization fails.
   */
  async createDriveClient(impersonateEmail: string): Promise<drive_v3.Drive> {
    // Check cache first
    if (this.driveClientCache.has(impersonateEmail)) {
      return this.driveClientCache.get(impersonateEmail)!;
    }

    // Create new client
    try {
      const auth = this.createAuthClient(impersonateEmail);
      
      const driveClient = google.drive({
        version: 'v3',
        auth: auth,
      });

      // Cache the client
      this.driveClientCache.set(impersonateEmail, driveClient);
      return driveClient;
    } catch (error) {
      this._handleAuthError(error, impersonateEmail);
    }
  }

  /**
   * Returns the admin email for the domain.
   * @returns The admin email address.
   */
  getAdminEmail(): string {
    return this.adminEmail;
  }

  /**
   * Creates an authenticated Google Drive API client for the admin user.
   * 
   * This is a convenience method that automatically uses the admin email
   * configured during initialization.
   * 
   * @returns Google Drive v3 API client authenticated as admin.
   * @throws {ProviderError} If the client cannot be created.
   * @throws {PermissionError} If authentication fails.
   */
  async createAdminDriveClient(): Promise<drive_v3.Drive> {
    return this.createDriveClient(this.adminEmail);
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Centralized error handling for authentication operations.
   * Distinguishes between configuration errors and permission/authentication errors.
   *
   * @param error - The caught error
   * @param email - The email of the user being authenticated
   * @throws {PermissionError} For authentication/authorization errors
   * @throws {ProviderError} For configuration and other errors
   */
  private _handleAuthError(error: unknown, email: string): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for permission/authentication related errors
    if (error && typeof error === 'object' && 'code' in error) {
      // 401 Unauthorized or 403 Forbidden indicate authentication issues
      if (error.code === 401 || error.code === 403) {
        throw new PermissionError(
          `Authentication failed for user ${email}. ${errorMessage}. ` +
          'Please verify domain-wide delegation is configured correctly.'
        );
      }
    }

    // Check error message for specific authentication keywords
    const errorMsgLower = errorMessage.toLowerCase();
    if (errorMsgLower.includes('unauthorized') || 
        errorMsgLower.includes('forbidden') || 
        errorMsgLower.includes('access denied') ||
        errorMsgLower.includes('permission') ||
        errorMsgLower.includes('authentication')) {
      throw new PermissionError(
        `Permission error during authentication for user ${email}: ${errorMessage}`
      );
    }

    // Default to ProviderError for configuration and other errors
    throw new ProviderError(
      `Failed to create authentication client for user: ${email}. ${errorMessage}`,
      error
    );
  }
}