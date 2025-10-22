import { GoogleAuthHelper } from './auth';
import { Document, NotFoundError, ProviderError, SearchDocumentsResult } from '../../src/types';
import { drive_v3 } from 'googleapis';

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

  /**
   * Search documents by metadata filters with token-based pagination.
   * Uses Google Drive query API to search by custom properties.
   * Always performed as admin.
   *
   * Example filters:
   * { activity_id: 'act_123', document_type: 'student_copy' }
   *
   * Becomes Google Drive query:
   * "properties has { key='activity_id' and value='act_123' } and
   *  properties has { key='document_type' and value='student_copy' }"
   *
   * @param filters - Metadata key-value filters
   * @param limit - Maximum results per page (default: 20, max: 100)
   * @param pageToken - Token from previous response for next page
   * @returns Search results with documents and next page token
   */
  async searchByMetadata(
    filters: Record<string, unknown>,
    limit: number = 20,
    pageToken?: string
  ): Promise<SearchDocumentsResult> {
    try {
      // Validate limit
      if (limit < 1 || limit > 100) {
        throw new ProviderError('Limit must be between 1 and 100');
      }

      const adminDrive = await this.authHelper.createAdminDriveClient();

      // Build query from filters
      const queryParts: string[] = [];

      for (const [key, value] of Object.entries(filters)) {
        // Convert value to string (same as setMetadata)
        let stringValue: string;
        if (value === null || value === undefined) {
          stringValue = '';
        } else if (typeof value === 'string') {
          stringValue = value;
        } else {
          stringValue = JSON.stringify(value);
        }

        // Escape single quotes in value
        const escapedValue = stringValue.replace(/'/g, "\\'");

        // Build query part
        queryParts.push(`properties has { key='${key}' and value='${escapedValue}' }`);
      }

      // Add "not trashed" filter
      queryParts.push('trashed=false');

      // Combine all query parts
      const query = queryParts.join(' and ');

      // Execute search with pagination
      const response = await adminDrive.files.list({
        q: query,
        fields:
          'nextPageToken, files(id,name,webViewLink,createdTime,modifiedTime,mimeType,properties)',
        pageSize: limit,
        pageToken: pageToken, // Use token if provided
        orderBy: 'modifiedTime desc' // Most recently modified first
      });

      const files = response.data.files || [];
      const nextPageToken = response.data.nextPageToken;

      // Transform to Document format
      const documents: Document[] = files.map((file) => this._toDocumentObject(file));

      return {
        documents,
        nextPageToken,
        limit
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      throw new ProviderError(`Failed to search documents by metadata ${errorMessage}`, error);
    }
  }

  /**
   * Converts a Google Drive file object to the internal Document format.
   *
   * @param file The Google Drive file to convert.
   * @returns The corresponding Document object.
   */
  private _toDocumentObject(file: drive_v3.Schema$File): Document {
    // Convert Google Drive properties to metadata
    const metadata: Record<string, unknown> = {};

    if (file.properties) {
      for (const [key, value] of Object.entries(file.properties)) {
        if (value !== null && value !== undefined) {
          // Try to parse JSON values, otherwise keep as string
          try {
            metadata[key] = JSON.parse(value);
          } catch {
            metadata[key] = value;
          }
        }
      }
    }

    return {
      document_id: file.id!,
      storage_reference: file.id!,
      name: file.name || 'Untitled',
      access_url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
      created_at: file.createdTime || new Date().toISOString(),
      updated_at: file.modifiedTime || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    };
  }
}
