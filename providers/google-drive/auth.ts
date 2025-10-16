import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { drive_v3 } from 'googleapis';
import { GoogleDriveConfig, ServiceAccountKey } from '../../src/types';
import { ProviderError } from '../../src/types';

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
   * @throws {ProviderError} If the client cannot be created.
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
      throw new ProviderError(
        `Failed to create auth client for user: ${impersonateEmail}`,
        error,
      );
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
      throw new ProviderError(
        `Failed to create Drive client for user: ${impersonateEmail}`,
        error,
      );
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
   */
  async createAdminDriveClient(): Promise<drive_v3.Drive> {
    return this.createDriveClient(this.adminEmail);
  }


}