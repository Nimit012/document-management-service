import { drive_v3 } from 'googleapis';
import { GoogleAuthHelper } from './auth';
import { ProviderError } from '../../src/types';

/**
 * Folder Manager
 * 
 * Handles folder hierarchy management in Google Drive:
 * - Create nested folder structures
 * - Find or create folders
 * - Always performed as admin (admin owns all folders)
 */
export class FolderManager {
  constructor(private authHelper: GoogleAuthHelper) {}

  /**
   * Create nested folder path
   * 
   * Example: "us_history2/unit1/masters"
   * Creates:
   * - us_history2/ (if doesn't exist)
   * - us_history2/unit1/ (if doesn't exist)
   * - us_history2/unit1/masters/ (if doesn't exist)
   * 
   * Returns: ID of the final folder (masters)
   * 
   * Always performed as admin
   * 
   * @param path - Folder path (e.g., "course/unit1/masters")
   * @returns ID of final folder in path
   */
  async createPath(path: string): Promise<string> {
    try {
      // Clean up path (remove leading/trailing slashes, empty segments)
      const segments = path
        .split('/')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (segments.length === 0) {
        throw new ProviderError('Folder path cannot be empty');
      }

      const adminEmail = this.authHelper.getAdminEmail();
      const adminDrive = this.authHelper.createDriveClient(adminEmail);

      let parentId: string | null = null;

      // Create each folder in the path
      for (const folderName of segments) {
        console.log(`📁 Processing folder: ${folderName} (parent: ${parentId || 'root'})`);
        
        parentId = await this.findOrCreateFolder(
          adminDrive,
          folderName,
          parentId
        );
        
        console.log(`✅ Folder ready: ${folderName} (id: ${parentId})`);
      }

      console.log(`✅ Complete folder path created: ${path}`);
      return parentId!;
    } catch (error: any) {
      throw new ProviderError(
        `Failed to create folder path "${path}": ${error.message}`,
        error
      );
    }
  }

  /**
   * Find existing folder or create new one
   * 
   * @param drive - Authenticated Drive client
   * @param folderName - Name of folder to find/create
   * @param parentId - Parent folder ID (null for root)
   * @returns Folder ID
   */
  private async findOrCreateFolder(
    drive: drive_v3.Drive,
    folderName: string,
    parentId: string | null
  ): Promise<string> {
    // Step 1: Search for existing folder
    const existingFolder = await this.findFolder(drive, folderName, parentId);

    if (existingFolder) {
      console.log(`  ℹ️ Folder already exists: ${folderName}`);
      return existingFolder;
    }

    // Step 2: Create new folder if not found
    console.log(`  ➕ Creating new folder: ${folderName}`);
    return await this.createFolder(drive, folderName, parentId);
  }

  /**
   * Search for existing folder
   * 
   * @param drive - Authenticated Drive client
   * @param folderName - Folder name to search for
   * @param parentId - Parent folder ID (null for root)
   * @returns Folder ID if found, null otherwise
   */
  private async findFolder(
    drive: drive_v3.Drive,
    folderName: string,
    parentId: string | null
  ): Promise<string | null> {
    try {
      // Escape single quotes in folder name
      const escapedName = folderName.replace(/'/g, "\\'");

      // Build query
      const queryParts = [
        `name='${escapedName}'`,
        `mimeType='application/vnd.google-apps.folder'`,
        `trashed=false`,
      ];

      // Add parent condition
      if (parentId) {
        queryParts.push(`'${parentId}' in parents`);
      } else {
        // Search in root (My Drive)
        queryParts.push(`'root' in parents`);
      }

      const query = queryParts.join(' and ');

      const response = await drive.files.list({
        q: query,
        fields: 'files(id,name)',
        pageSize: 1, // We only need first match
      });

      const folders = response.data.files || [];

      if (folders.length > 0) {
        return folders[0].id!;
      }

      return null;
    } catch (error: any) {
      console.warn(`  ⚠️ Error searching for folder ${folderName}:`, error.message);
      return null; // If search fails, we'll create it
    }
  }

  /**
   * Create new folder
   * 
   * @param drive - Authenticated Drive client
   * @param folderName - Name for new folder
   * @param parentId - Parent folder ID (null for root)
   * @returns New folder ID
   */
  private async createFolder(
    drive: drive_v3.Drive,
    folderName: string,
    parentId: string | null
  ): Promise<string> {
    const folderMetadata: drive_v3.Schema$File = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    };

    const response = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id,name',
    });

    if (!response.data || !response.data.id) {
      throw new ProviderError(`Failed to create folder: ${folderName}`);
    }

    return response.data.id;
  }
}