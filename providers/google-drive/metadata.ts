import { drive_v3 } from 'googleapis';
import { GoogleAuthHelper } from './auth';
import { ProviderError } from '../../src/types';

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


}