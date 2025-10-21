import { GoogleAuthHelper } from './auth';
import { NotFoundError, ProviderError } from '../../src/types';

/**
 * Metadata management for Google Drive documents.
 *
 * Handles retrieval and updates of document metadata.
 */
export class DocumentMetadata {
  /**
   * Helper for Google authentication and impersonation.
   */
  private authHelper: GoogleAuthHelper;

  /**
   * Constructs a new DocumentMetadata instance.
   * @param authHelper The authentication helper for creating Drive clients.
   */
  constructor(authHelper: GoogleAuthHelper) {
    this.authHelper = authHelper;
  }

  /**
   * Set custom metadata on a document
   * Stored as Google Drive file properties
   * Always performed as admin
   *
   * Note: Google Drive properties are key-value strings.
   * Non-string values are JSON-stringified.
   *
   * @param documentId - Document ID
   * @param metadata - Key-value metadata object
   */
  async setMetadata(documentId: string, metadata: Record<string, unknown>): Promise<void> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      // Convert all values to strings (Google Drive requirement)
      const properties: Record<string, string> = {};
      for (const [key, value] of Object.entries(metadata)) {
        if (value === null || value === undefined) {
          properties[key] = '';
        } else if (typeof value === 'string') {
          properties[key] = value;
        } else {
          // JSON stringify objects, numbers, booleans, arrays
          properties[key] = JSON.stringify(value);
        }
      }

      await adminDriveClient.files.update({
        fileId: documentId,
        requestBody: {
          properties: properties
        },
        fields: 'properties'
      });

      console.log(`✅ Metadata set on ${documentId}:`, Object.keys(properties));
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new ProviderError(
        `Failed to set metadata on document ${documentId}: ${errorMessage}`,
        error
      );
    }
  }

  /**
   * Get custom metadata from a document
   * Always performed as admin
   *
   * @param documentId - Document ID
   * @returns Metadata object (with values parsed back from strings)
   */
  async getMetadata(documentId: string): Promise<Record<string, unknown>> {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();

      const response = await adminDriveClient.files.get({
        fileId: documentId,
        fields: 'properties'
      });

      const properties = response.data.properties || {};

      // Parse values back (attempt JSON parse, fallback to string)
      const metadata: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(properties)) {
        if (value === '') {
          metadata[key] = null;
        } else {
          try {
            // Try to parse as JSON (for objects, numbers, booleans, arrays)
            metadata[key] = JSON.parse(value);
          } catch {
            // Not JSON, keep as string
            metadata[key] = value;
          }
        }
      }

      return metadata;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      throw new ProviderError(
        `Failed to get metadata for document ${documentId}: ${errorMessage}`,
        error
      );
    }
  }
}
