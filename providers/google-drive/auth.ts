import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { drive_v3 } from 'googleapis';
import { GoogleDriveConfig, ServiceAccountKey } from '../../src/types';
import { ProviderError } from '../../src/types';

/**
 * Google Auth Helper
 * 
 * Handles authentication and client creation for Google Drive API
 * using service account with domain-wide delegation.
 * 
 * Key concept: Service account can impersonate any user in the domain
 * by setting the 'subject' field in JWT credentials.
 */
export class GoogleAuthHelper {
  private serviceAccountKey: ServiceAccountKey;
  private adminEmail: string;
  private scopes: string[];

  /**
   * @param config - Google Drive configuration with service account credentials
   */
  constructor(config: GoogleDriveConfig) {
    this.serviceAccountKey = config.serviceAccountKey;
    this.adminEmail = config.adminEmail;

    // Define OAuth scopes - what permissions we need
    this.scopes = [
      'https://www.googleapis.com/auth/drive', // Full Drive access
      'https://www.googleapis.com/auth/drive.file', // Access to files created by app
      'https://www.googleapis.com/auth/drive.metadata', // Access to file metadata
    ];

    // Validate service account key structure
    this.validateServiceAccountKey();
  }

  /**
   * Validate that service account key has required fields
   */
  private validateServiceAccountKey(): void {
    const required = ['client_email', 'private_key'];
    const missing = required.filter(field => !this.serviceAccountKey[field]);

    if (missing.length > 0) {
      throw new ProviderError(
        `Service account key is missing required fields: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Create JWT auth client that impersonates a specific user
   * 
   * This is the core of domain-wide delegation:
   * - Service account authenticates as itself
   * - Then acts as the specified user (subject)
   * - All API calls appear to come from that user
   * 
   * @param impersonateEmail - Email of user to impersonate
   * @returns Authenticated JWT client
   */
  createAuthClient(impersonateEmail: string): JWT {
    try {
      const jwtClient = new google.auth.JWT({
        email: this.serviceAccountKey.client_email,
        key: this.serviceAccountKey.private_key,
        scopes: this.scopes,
        subject: impersonateEmail, // THIS IS THE IMPERSONATION MAGIC
      });

      return jwtClient;
    } catch (error) {
      throw new ProviderError(
        `Failed to create auth client for user: ${impersonateEmail}`,
        error
      );
    }
  }

  /**
   * Create authenticated Google Drive API client
   * 
   * This is what you'll use to make actual API calls.
   * All calls will be made as the impersonated user.
   * 
   * @param impersonateEmail - Email of user to impersonate
   * @returns Google Drive v3 API client
   */
  createDriveClient(impersonateEmail: string): drive_v3.Drive {
    try {
      const auth = this.createAuthClient(impersonateEmail);

      const driveClient = google.drive({
        version: 'v3',
        auth: auth,
      });

      return driveClient;
    } catch (error) {
      throw new ProviderError(
        `Failed to create Drive client for user: ${impersonateEmail}`,
        error
      );
    }
  }

  /**
   * Get admin email (for convenience)
   */
  getAdminEmail(): string {
    return this.adminEmail;
  }

  /**
   * Test authentication by making a simple API call
   * Useful for debugging and validating setup
   * 
   * @param impersonateEmail - Email to test impersonation with
   * @returns True if authentication works
   */
  async testAuthentication(impersonateEmail: string): Promise<boolean> {
    try {
      const drive = this.createDriveClient(impersonateEmail);

      // Make a simple API call - get user's about info
      const response = await drive.about.get({
        fields: 'user',
      });

      if (response.data.user?.emailAddress === impersonateEmail) {
        console.log(`✅ Successfully authenticated as: ${impersonateEmail}`);
        return true;
      } else {
        console.error(`❌ Authentication failed - expected ${impersonateEmail}, got ${response.data.user?.emailAddress}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Authentication test failed for ${impersonateEmail}:`, error);
      throw new ProviderError(
        `Authentication test failed for ${impersonateEmail}. Make sure domain-wide delegation is enabled.`,
        error
      );
    }
  }
}