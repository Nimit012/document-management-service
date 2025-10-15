import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
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
 * by setting the 'subject' field in JWT credentials.
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
      'https://www.googleapis.com/auth/drive.file', // Access to files created by app
      'https://www.googleapis.com/auth/drive.metadata', // Access to file metadata
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
    const required = ['client_email', 'private_key'];
    const missing = required.filter(field => !this.serviceAccountKey[field]);

    if (missing.length > 0) {
      throw new ProviderError(
        `Service account key is missing required fields: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Creates a JWT auth client that impersonates a specific user.
   *
   * Domain-wide delegation steps:
   * - Service account authenticates as itself.
   * - Acts as the specified user (subject).
   * - All API calls appear to come from that user.
   *
   * @param impersonateEmail Email of the user to impersonate.
   * @returns Authenticated JWT client.
   * @throws {ProviderError} If the client cannot be created.
   */
  createAuthClient(impersonateEmail: string): JWT {
    try {
      const jwtClient = new google.auth.JWT({
        email: this.serviceAccountKey.client_email,
        key: this.serviceAccountKey.private_key,
        scopes: this.scopes,
        subject: impersonateEmail, // Impersonation
      });

      return jwtClient;
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
  createDriveClient(impersonateEmail: string): drive_v3.Drive {
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
}