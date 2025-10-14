import { drive_v3 } from 'googleapis';
import { GoogleAuthHelper } from './auth';
import { Document, ProviderError, NotFoundError, SearchDocumentsResult } from '../../src/types';

/**
 * Metadata Manager
 * 
 * Handles metadata storage using Google Drive custom file properties.
 * NO DATABASE - all metadata is stored directly in Google Drive.
 * 
 * Key operations:
 * - Set metadata as custom properties
 * - Get metadata from properties
 * - Search documents by metadata using Drive query API
 */
export class MetadataManager {
  constructor(private authHelper: GoogleAuthHelper) {}

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
  async setMetadata(
    documentId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      const adminEmail = this.authHelper.getAdminEmail();
      const adminDrive = this.authHelper.createDriveClient(adminEmail);

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

      await adminDrive.files.update({
        fileId: documentId,
        requestBody: {
          properties: properties,
        },
        fields: 'properties',
      });

      console.log(`✅ Metadata set on ${documentId}:`, Object.keys(properties));
    } catch (error: any) {
      if (error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      throw new ProviderError(
        `Failed to set metadata on document ${documentId}: ${error.message}`,
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
  async getMetadata(documentId: string): Promise<Record<string, any>> {
    try {
      const adminEmail = this.authHelper.getAdminEmail();
      const adminDrive = this.authHelper.createDriveClient(adminEmail);

      const response = await adminDrive.files.get({
        fileId: documentId,
        fields: 'properties',
      });

      const properties = response.data.properties || {};

      // Parse values back (attempt JSON parse, fallback to string)
      const metadata: Record<string, any> = {};
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
    } catch (error: any) {
      if (error.code === 404) {
        throw new NotFoundError('Document', documentId);
      }
      throw new ProviderError(
        `Failed to get metadata for document ${documentId}: ${error.message}`,
        error
      );
    }
  }

  /**
   * Search documents by metadata filters
   * Uses Google Drive query API to search by custom properties
   * Always performed as admin
   * 
   * Example filters:
   * { activity_id: 'act_123', document_type: 'student_copy' }
   * 
   * Becomes Google Drive query:
   * "properties has { key='activity_id' and value='act_123' } and
   *  properties has { key='document_type' and value='student_copy' }"
   * 
   * @param filters - Metadata key-value filters
   * @param limit - Maximum results (default: 20)
   * @param offset - Pagination offset (default: 0)
   * @returns Search results with documents
   */
  async searchByMetadata(
    filters: Record<string, any>,
    limit: number = 20,
    offset: number = 0
  ): Promise<SearchDocumentsResult> {
    try {
      const adminEmail = this.authHelper.getAdminEmail();
      const adminDrive = this.authHelper.createDriveClient(adminEmail);

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

      console.log(`🔍 Searching with query: ${query}`);

      // Execute search
      const response = await adminDrive.files.list({
        q: query,
        fields: 'files(id,name,webViewLink,createdTime,modifiedTime,mimeType,properties)',
        pageSize: limit,
        orderBy: 'modifiedTime desc', // Most recently modified first
      });

      const files = response.data.files || [];

      // Note: Google Drive API doesn't support offset natively
      // We'd need to implement pagination using pageToken for production
      // For now, we'll slice the results (works for small datasets)
      const paginatedFiles = files.slice(offset, offset + limit);

      // Transform to Document format
      const documents: Document[] = paginatedFiles.map((file) =>
        this.transformToDocument(file)
      );

      return {
        documents,
        total: files.length, // Note: This is approximation, Drive API doesn't give exact total
        limit,
        offset,
      };
    } catch (error: any) {
      throw new ProviderError(
        `Failed to search documents by metadata: ${error.message}`,
        error
      );
    }
  }

  /**
   * Transform Google Drive file to Document format
   * 
   * @param file - Google Drive file object
   * @returns Document object
   */
  private transformToDocument(file: drive_v3.Schema$File): Document {
    // Parse metadata from properties
    const metadata: Record<string, any> = {};
    if (file.properties) {
      for (const [key, value] of Object.entries(file.properties)) {
        try {
          metadata[key] = JSON.parse(value);
        } catch {
          metadata[key] = value;
        }
      }
    }

    return {
      document_id: file.id!,
      provider: 'google_drive',
      storage_reference: file.id!,
      name: file.name || 'Untitled',
      access_url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
      created_at: file.createdTime || new Date().toISOString(),
      updated_at: file.modifiedTime,
      metadata,
    };
  }
}