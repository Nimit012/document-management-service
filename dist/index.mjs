import { google } from 'googleapis';

// src/types/provider.types.ts
var ProviderType = /* @__PURE__ */ ((ProviderType2) => {
  ProviderType2["GOOGLE_DRIVE"] = "google_drive";
  ProviderType2["S3"] = "s3";
  return ProviderType2;
})(ProviderType || {});

// src/types/errors.types.ts
var DocumentStorageError = class _DocumentStorageError extends Error {
  constructor(message) {
    super(message);
    this.name = "DocumentStorageError";
    Object.setPrototypeOf(this, _DocumentStorageError.prototype);
  }
};
var ProviderError = class _ProviderError extends DocumentStorageError {
  constructor(message, originalError) {
    super(message);
    this.originalError = originalError;
    this.name = "ProviderError";
    Object.setPrototypeOf(this, _ProviderError.prototype);
  }
};
var ValidationError = class _ValidationError extends DocumentStorageError {
  constructor(message) {
    super(`Validation error: ${message}`);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, _ValidationError.prototype);
  }
};
var NotFoundError = class _NotFoundError extends DocumentStorageError {
  constructor(resourceType, resourceId) {
    super(`${resourceType} not found: ${resourceId}`);
    this.name = "NotFoundError";
    Object.setPrototypeOf(this, _NotFoundError.prototype);
  }
};
var PermissionError = class _PermissionError extends DocumentStorageError {
  constructor(message) {
    super(`Permission error: ${message}`);
    this.name = "PermissionError";
    Object.setPrototypeOf(this, _PermissionError.prototype);
  }
};
var NotImplementedError = class _NotImplementedError extends DocumentStorageError {
  constructor(feature, provider) {
    super(`Feature '${feature}' not implemented by provider '${provider}'`);
    this.name = "NotImplementedError";
    Object.setPrototypeOf(this, _NotImplementedError.prototype);
  }
};
var GoogleAuthHelper = class {
  /**
   * Constructs a new GoogleAuthHelper instance.
   * @param config Google Drive configuration with service account credentials.
   */
  constructor(config) {
    this.serviceAccountKey = config.serviceAccountKey;
    this.adminEmail = config.adminEmail;
    this.scopes = [
      "https://www.googleapis.com/auth/drive"
      // Full Drive access
    ];
    this.driveClientCache = /* @__PURE__ */ new Map();
    this.validateServiceAccountKey();
  }
  /**
   * Validates that the service account key contains all required fields.
   * @throws {ProviderError} If required fields are missing.
   */
  validateServiceAccountKey() {
    const required = ["client_email", "private_key"];
    const missing = required.filter((field) => !this.serviceAccountKey[field]);
    if (missing.length > 0) {
      throw new ProviderError(
        `Service account key is missing required fields: ${missing.join(", ")}`
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
  createAuthClient(impersonateEmail) {
    try {
      const auth = new google.auth.GoogleAuth({
        credentials: this.serviceAccountKey,
        scopes: this.scopes,
        clientOptions: {
          subject: impersonateEmail
          // Impersonation
        }
      });
      return auth;
    } catch (error) {
      throw new ProviderError(
        `Failed to create auth client for user: ${impersonateEmail}`,
        error
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
  async createDriveClient(impersonateEmail) {
    if (this.driveClientCache.has(impersonateEmail)) {
      return this.driveClientCache.get(impersonateEmail);
    }
    try {
      const auth = this.createAuthClient(impersonateEmail);
      const driveClient = google.drive({
        version: "v3",
        auth
      });
      this.driveClientCache.set(impersonateEmail, driveClient);
      return driveClient;
    } catch (error) {
      throw new ProviderError(
        `Failed to create Drive client for user: ${impersonateEmail}`,
        error
      );
    }
  }
  /**
   * Returns the admin email for the domain.
   * @returns The admin email address.
   */
  getAdminEmail() {
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
  async createAdminDriveClient() {
    return this.createDriveClient(this.adminEmail);
  }
};

// providers/google-drive/operations.ts
var DocumentOperations = class {
  /**
   * Creates a new DocumentOperations instance.
   * @param authHelper The GoogleAuthHelper used for authentication and impersonation.
   */
  constructor(authHelper) {
    this.authHelper = authHelper;
  }
  /**
   * Copies a document from the source owner's account.
   *
   * @param sourceDocId Source document ID to copy from.
   * @param sourceOwnerEmail Email of the user who owns/can access the source.
   * @param newName Name for the copied document (optional).
   * @returns Copied file metadata as a Drive file object.
   * @throws {NotFoundError} If the source document is not found.
   * @throws {ProviderError} If the copy operation fails.
   */
  async copyDocument(sourceDocId, sourceOwnerEmail, newName) {
    try {
      const sourceDriveClient = await this.authHelper.createDriveClient(sourceOwnerEmail);
      const copyResponse = await sourceDriveClient.files.copy({
        fileId: sourceDocId,
        requestBody: {
          name: newName
        },
        fields: "id,name,webViewLink,createdTime,modifiedTime,mimeType"
        // return these fields in response
      });
      return copyResponse.data;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 404) {
        throw new NotFoundError("Document", sourceDocId);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(`Failed to copy document: ${errorMessage}`, error);
    }
  }
  /**
   * Get document metadata
   * Always performed as admin
   *
   * @param documentId - Document ID
   * @returns Document metadata
   */
  async getDocument(documentId) {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      const response = await adminDriveClient.files.get({
        fileId: documentId,
        fields: "id,name,webViewLink,createdTime,modifiedTime,mimeType,properties"
      });
      if (!response.data) {
        throw new NotFoundError("Document", documentId);
      }
      return response.data;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 404) {
        throw new NotFoundError("Document", documentId);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(`Failed to get document ${documentId}: ${errorMessage}`, error);
    }
  }
  /**
   * Update document name
   * Always performed as admin
   *
   * @param documentId - Document ID
   * @param newName - New document name
   */
  async updateName(documentId, newName) {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      await adminDriveClient.files.update({
        fileId: documentId,
        requestBody: {
          name: newName
        }
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 404) {
        throw new NotFoundError("Document", documentId);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(
        `Failed to update document name ${documentId}: ${errorMessage}`,
        error
      );
    }
  }
  /**
   * Delete document permanently
   * Always performed as admin
   *
   * @param documentId - Document ID
   */
  async deleteDocument(documentId) {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      await adminDriveClient.files.delete({
        fileId: documentId
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 404) {
        throw new NotFoundError("Document", documentId);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(`Failed to delete document ${documentId}: ${errorMessage}`, error);
    }
  }
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
  async createPath(path) {
    try {
      const segments = path.split("/").map((s) => s.trim()).filter((s) => s.length > 0);
      if (segments.length === 0) {
        throw new ProviderError("Folder path cannot be empty");
      }
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      let parentId = null;
      for (const folderName of segments) {
        parentId = await this._findOrCreateFolder(adminDriveClient, folderName, parentId);
      }
      return parentId;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(`Failed to create folder path "${path}": ${errorMessage}`, error);
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
  async _findOrCreateFolder(drive, folderName, parentId) {
    const existingFolder = await this._findFolder(drive, folderName, parentId);
    if (existingFolder) {
      return existingFolder;
    }
    return await this._createFolder(drive, folderName, parentId);
  }
  /**
   * Search for existing folder
   *
   * @param drive - Authenticated Drive client
   * @param folderName - Folder name to search for
   * @param parentId - Parent folder ID (null for root)
   * @returns Folder ID if found, null otherwise
   */
  async _findFolder(drive, folderName, parentId) {
    try {
      const escapedName = folderName.replace(/'/g, "\\'");
      const queryParts = [
        `name='${escapedName}'`,
        `mimeType='application/vnd.google-apps.folder'`,
        `trashed=false`
      ];
      if (parentId) {
        queryParts.push(`'${parentId}' in parents`);
      } else {
        queryParts.push(`'root' in parents`);
      }
      const query = queryParts.join(" and ");
      const response = await drive.files.list({
        q: query,
        fields: "files(id,name)",
        pageSize: 1
        // We only need first match
      });
      const folders = response.data.files || [];
      if (folders.length > 0) {
        return folders[0].id;
      }
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.warn(`  \u26A0\uFE0F Error searching for folder ${folderName}:`, errorMessage);
      return null;
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
  async _createFolder(drive, folderName, parentId) {
    const folderMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : void 0
    };
    const response = await drive.files.create({
      requestBody: folderMetadata,
      fields: "id,name"
    });
    if (!response.data || !response.data.id) {
      throw new ProviderError(`Failed to create folder: ${folderName}`);
    }
    return response.data.id;
  }
  /**
   * Moves a document to a specific folder.
   * Removes document from all current parent folders and places in new folder.
   * Always performed as admin.
   *
   * @param fileId The ID of the file to move.
   * @param folderId The ID of the destination folder.
   * @throws {ProviderError} If the move operation fails.
   */
  async moveToFolder(fileId, folderId) {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      const file = await adminDriveClient.files.get({
        fileId,
        fields: "parents"
      });
      const previousParents = file.data.parents?.join(",") || "";
      await adminDriveClient.files.update({
        fileId,
        addParents: folderId,
        removeParents: previousParents,
        fields: "id,parents"
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(`Failed to move document to folder: ${errorMessage}`, error);
    }
  }
  /**
   * Retrieves comments for a document from Google Drive.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document.
   * @returns A promise resolving to an array of Comment objects.
   * @throws {NotFoundError} If the document is not found.
   * @throws {ProviderError} If the operation fails.
   */
  async getComments(documentId) {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      const response = await adminDriveClient.comments.list({
        fileId: documentId,
        fields: "comments(id,content,author,createdTime,resolved,replies)"
      });
      const comments = response.data.comments || [];
      return comments.map((comment) => ({
        comment_id: comment.id,
        author: comment.author?.displayName || "Unknown",
        content: comment.content,
        created_at: comment.createdTime,
        resolved: comment.resolved || false,
        replies: (comment.replies || []).map((reply) => ({
          reply_id: reply.id,
          author: reply.author?.displayName || "Unknown",
          content: reply.content,
          created_at: reply.createdTime
        }))
      }));
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 404) {
        throw new NotFoundError("Document", documentId);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(
        `Failed to get comments for document ${documentId}: ${errorMessage}`,
        error
      );
    }
  }
  /**
   * Retrieves revisions for a document from Google Drive.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document.
   * @returns A promise resolving to an array of Revision objects.
   * @throws {NotFoundError} If the document is not found.
   * @throws {ProviderError} If the operation fails.
   */
  async getRevisions(documentId) {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      const response = await adminDriveClient.revisions.list({
        fileId: documentId,
        fields: "revisions(id,modifiedTime,lastModifyingUser,exportLinks)"
      });
      const revisions = response.data.revisions || [];
      return revisions.map((rev) => ({
        revision_id: rev.id,
        modified_time: rev.modifiedTime,
        modified_by: rev.lastModifyingUser?.emailAddress || "Unknown",
        export_links: rev.exportLinks || void 0
      }));
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 404) {
        throw new NotFoundError("Document", documentId);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(
        `Failed to get revisions for document ${documentId}: ${errorMessage}`,
        error
      );
    }
  }
};

// providers/google-drive/permissions.ts
var DocumentPermissions = class {
  /**
   * Constructs a new DocumentPermissions instance.
   * @param authHelper The authentication helper for creating Drive clients.
   */
  constructor(authHelper) {
    this.authHelper = authHelper;
  }
  /**
   * Transfers ownership of a document to the admin.
   *
   * @param sourceOwnerEmail Email of the current document owner.
   * @param fileId The ID of the file to transfer ownership of.
   * @throws {ProviderError} If the ownership transfer fails.
   */
  async transferToAdmin(sourceOwnerEmail, fileId) {
    try {
      const adminEmail = this.authHelper.getAdminEmail();
      const sourceDriveClient = await this.authHelper.createDriveClient(sourceOwnerEmail);
      await sourceDriveClient.permissions.create({
        fileId,
        requestBody: {
          role: "owner",
          type: "user",
          emailAddress: adminEmail
        },
        transferOwnership: true
      });
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      const permissions = await adminDriveClient.permissions.list({
        fileId,
        fields: "permissions(id,emailAddress,role)"
      });
      const teacherPermission = permissions.data.permissions?.find(
        (p) => p.emailAddress === sourceOwnerEmail
      );
      if (teacherPermission?.id) {
        await adminDriveClient.permissions.delete({
          fileId,
          permissionId: teacherPermission.id
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(`Failed to transfer ownership to admin: ${errorMessage}`, error);
    }
  }
  /**
   * Set permissions on a document
   * Replaces ALL existing permissions except owner
   * Always performed as admin
   *
   * Flow:
   * 1. Get all existing permissions
   * 2. Delete all non-owner permissions
   * 3. Create new permissions from accessControl array
   *
   * @param documentId - Document ID
   * @param accessControl - Array of access control rules
   */
  async setPermissions(documentId, accessControl) {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      const existingPermissions = await adminDriveClient.permissions.list({
        fileId: documentId,
        fields: "permissions(id,role,emailAddress,type)"
      });
      const permissions = existingPermissions.data.permissions || [];
      for (const permission of permissions) {
        if (permission.role === "owner") {
          continue;
        }
        if (permission.id) {
          try {
            await adminDriveClient.permissions.delete({
              fileId: documentId,
              permissionId: permission.id
            });
          } catch (error) {
            console.warn(`Failed to remove permission ${permission.id}:`, error);
          }
        }
      }
      for (const ac of accessControl) {
        const role = this._mapAccessLevelToRole(ac.access_level);
        await adminDriveClient.permissions.create({
          fileId: documentId,
          requestBody: {
            role,
            type: "user",
            emailAddress: ac.user
          },
          sendNotificationEmail: false
          // Don't spam users with emails
        });
      }
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 404) {
        throw new NotFoundError("Document", documentId);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(
        `Failed to set permissions on document ${documentId}: ${errorMessage}`,
        error
      );
    }
  }
  /**
   * Get current permissions on a document
   * Excludes owner permission
   * Always performed as admin
   *
   * @param documentId - Document ID
   * @returns Array of access control rules
   */
  async getPermissions(documentId) {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      const response = await adminDriveClient.permissions.list({
        fileId: documentId,
        fields: "permissions(id,role,emailAddress,type)"
      });
      const permissions = response.data.permissions || [];
      const accessControl = permissions.filter((p) => p.role !== "owner" && p.emailAddress).map((p) => ({
        user: p.emailAddress,
        access_level: this._mapRoleToAccessLevel(p.role)
      }));
      return accessControl;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 404) {
        throw new NotFoundError("Document", documentId);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(
        `Failed to get permissions for document ${documentId}: ${errorMessage}`,
        error
      );
    }
  }
  /**
   * Map our access level to Google Drive role
   *
   * @param accessLevel - Our access level (read, read_write, comment)
   * @returns Google Drive role (reader, writer, commenter)
   */
  _mapAccessLevelToRole(accessLevel) {
    const mapping = {
      read: "reader",
      read_write: "writer",
      comment: "commenter"
    };
    const role = mapping[accessLevel];
    if (!role) {
      throw new ProviderError(
        `Invalid access level: ${accessLevel}. Must be read, read_write, or comment`
      );
    }
    return role;
  }
  /**
   * Map Google Drive role to our access level
   *
   * @param role - Google Drive role (reader, writer, commenter)
   * @returns Our access level (read, read_write, comment)
   */
  _mapRoleToAccessLevel(role) {
    const mapping = {
      reader: "read",
      writer: "read_write",
      commenter: "comment"
    };
    return mapping[role] || "read";
  }
};

// providers/google-drive/metadata.ts
var DocumentMetadata = class {
  /**
   * Constructs a new DocumentMetadata instance.
   * @param authHelper The authentication helper for creating Drive clients.
   */
  constructor(authHelper) {
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
  async setMetadata(documentId, metadata) {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      const properties = {};
      for (const [key, value] of Object.entries(metadata)) {
        if (value === null || value === void 0) {
          properties[key] = "";
        } else if (typeof value === "string") {
          properties[key] = value;
        } else {
          properties[key] = JSON.stringify(value);
        }
      }
      await adminDriveClient.files.update({
        fileId: documentId,
        requestBody: {
          properties
        },
        fields: "properties"
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 404) {
        throw new NotFoundError("Document", documentId);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
  async getMetadata(documentId) {
    try {
      const adminDriveClient = await this.authHelper.createAdminDriveClient();
      const response = await adminDriveClient.files.get({
        fileId: documentId,
        fields: "properties"
      });
      const properties = response.data.properties || {};
      const metadata = {};
      for (const [key, value] of Object.entries(properties)) {
        if (value === "") {
          metadata[key] = null;
        } else {
          try {
            metadata[key] = JSON.parse(value);
          } catch {
            metadata[key] = value;
          }
        }
      }
      return metadata;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 404) {
        throw new NotFoundError("Document", documentId);
      }
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
  async searchByMetadata(filters, limit = 20, pageToken) {
    try {
      if (limit < 1 || limit > 100) {
        throw new ProviderError("Limit must be between 1 and 100");
      }
      const adminDrive = await this.authHelper.createAdminDriveClient();
      const queryParts = [];
      for (const [key, value] of Object.entries(filters)) {
        let stringValue;
        if (value === null || value === void 0) {
          stringValue = "";
        } else if (typeof value === "string") {
          stringValue = value;
        } else {
          stringValue = JSON.stringify(value);
        }
        const escapedValue = stringValue.replace(/'/g, "\\'");
        queryParts.push(`properties has { key='${key}' and value='${escapedValue}' }`);
      }
      queryParts.push("trashed=false");
      const query = queryParts.join(" and ");
      const response = await adminDrive.files.list({
        q: query,
        fields: "nextPageToken, files(id,name,webViewLink,createdTime,modifiedTime,mimeType,properties)",
        pageSize: limit,
        pageToken,
        // Use token if provided
        orderBy: "modifiedTime desc"
        // Most recently modified first
      });
      const files = response.data.files || [];
      const nextPageToken = response.data.nextPageToken;
      const documents = files.map((file) => this._toDocumentObject(file));
      return {
        documents,
        nextPageToken,
        limit
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(`Failed to search documents by metadata ${errorMessage}`, error);
    }
  }
  /**
   * Converts a Google Drive file object to the internal Document format.
   *
   * @param file The Google Drive file to convert.
   * @returns The corresponding Document object.
   */
  _toDocumentObject(file) {
    const metadata = {};
    if (file.properties) {
      for (const [key, value] of Object.entries(file.properties)) {
        if (value !== null && value !== void 0) {
          try {
            metadata[key] = JSON.parse(value);
          } catch {
            metadata[key] = value;
          }
        }
      }
    }
    return {
      document_id: file.id,
      storage_reference: file.id,
      name: file.name || "Untitled",
      access_url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
      created_at: file.createdTime || (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: file.modifiedTime || void 0,
      metadata: Object.keys(metadata).length > 0 ? metadata : void 0
    };
  }
};

// providers/google-drive/GoogleDriveProvider.ts
var GoogleDriveProvider = class {
  /**
   * Constructs a new GoogleDriveProvider instance.
   * @param config The configuration object for Google Drive integration.
   */
  constructor(config) {
    this.authHelper = new GoogleAuthHelper(config);
    this.operations = new DocumentOperations(this.authHelper);
    this.permissions = new DocumentPermissions(this.authHelper);
    this.metadata = new DocumentMetadata(this.authHelper);
  }
  // ==================== DOCUMENT OPERATIONS ====================
  /**
   * Copies a document in Google Drive according to the request details.
   *
   * Steps:
   * 1. Copies the source document, impersonating the source owner.
   * 2. Transfers ownership to admin.
   * 3. Creates the target folder structure if `folder_path` is provided and moves document.
   * 4. Sets permissions if `access_control` is specified.
   * 5. Sets metadata if `metadata` is specified.
   * 6. Transforms the copied file into the Document format.
   *
   * @param request The document creation request, including source reference, owner, name, folder path, access control, and metadata.
   * @returns The created Document object.
   * @throws {ProviderError} If any step fails during the process.
   */
  async copyDocumentFromSource(request) {
    try {
      const copiedFile = await this.operations.copyDocument(
        request.source_reference,
        request.source_owner,
        request.name
      );
      await this.permissions.transferToAdmin(request.source_owner, copiedFile.id);
      if (request.folder_path) {
        const folderId = await this.operations.createPath(request.folder_path);
        await this.operations.moveToFolder(copiedFile.id, folderId);
      }
      if (request.access_control && request.access_control.length > 0) {
        await this.permissions.setPermissions(copiedFile.id, request.access_control);
      }
      if (request.metadata) {
        await this.metadata.setMetadata(copiedFile.id, request.metadata);
      }
      return this._toDocumentObject(copiedFile);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(`Failed to create document: ${errorMessage}`, error);
    }
  }
  /**
   * Retrieves a document's metadata from Google Drive and transforms it into the Document format.
   *
   * @param documentId - The unique identifier of the Google Drive document.
   * @returns The corresponding Document object in the internal format.
   */
  async getDocument(documentId) {
    const file = await this.operations.getDocument(documentId);
    return this._toDocumentObject(file);
  }
  /**
   * Updates a document's name and/or metadata in Google Drive.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - ID of the document to update.
   * @param updates - Object containing the new name and/or metadata to set.
   * @returns The updated Document object.
   */
  async updateDocument(documentId, updates) {
    try {
      if (updates.name) {
        await this.operations.updateName(documentId, updates.name);
      }
      if (updates.metadata) {
        const existingMetadata = await this.metadata.getMetadata(documentId);
        const mergedMetadata = { ...existingMetadata, ...updates.metadata };
        await this.metadata.setMetadata(documentId, mergedMetadata);
      }
      return await this.getDocument(documentId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      throw new ProviderError(`Failed to update document: ${errorMessage}`, error);
    }
  }
  /**
   * Deletes a document permanently by its ID from Google Drive.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document to delete.
   * @returns A promise that resolves when the document is deleted.
   */
  async deleteDocument(documentId) {
    await this.operations.deleteDocument(documentId);
  }
  /**
   * Sets access permissions for a document, replacing all existing non-owner permissions.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document to update permissions for.
   * @param accessControl - Array of AccessControl rules to apply.
   * @returns A promise that resolves when permissions are set.
   */
  async setPermissions(documentId, accessControl) {
    await this.permissions.setPermissions(documentId, accessControl);
  }
  /**
   * Searches for documents by metadata filters in Google Drive.
   * Always performed as admin (who owns all documents).
   *
   * @param filters - Key-value pairs of metadata fields to filter.
   * @param limit - Maximum number of documents to return (default: 20).
   * @param offset - Pagination offset (default: 0).
   * @returns A promise resolving to a SearchDocumentsResult with found documents.
   */
  async searchByMetadata(filters, limit = 20, pageToken) {
    return await this.metadata.searchByMetadata(filters, limit, pageToken);
  }
  /**
   * Retrieves comments for a specific document from Google Drive.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document.
   * @returns A promise resolving to an array of Comment objects.
   */
  async getComments(documentId) {
    return await this.operations.getComments(documentId);
  }
  /**
   * Retrieves revision history for a specific document from Google Drive.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document.
   * @returns A promise resolving to an array of Revision objects.
   */
  async getRevisions(documentId) {
    return await this.operations.getRevisions(documentId);
  }
  // ==================== HELPER METHODS ====================
  /**
   * Converts a Google Drive file object to the internal Document format.
   *
   * @param file The Google Drive file to convert.
   * @returns The corresponding Document object.
   */
  _toDocumentObject(file) {
    const metadata = {};
    if (file.properties) {
      for (const [key, value] of Object.entries(file.properties)) {
        if (value !== null && value !== void 0) {
          try {
            metadata[key] = JSON.parse(value);
          } catch {
            metadata[key] = value;
          }
        }
      }
    }
    return {
      document_id: file.id,
      storage_reference: file.id,
      name: file.name || "Untitled",
      access_url: file.webViewLink || `https://docs.google.com/document/d/${file.id}/edit`,
      created_at: file.createdTime || (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: file.modifiedTime || void 0,
      metadata: Object.keys(metadata).length > 0 ? metadata : void 0
    };
  }
};

// src/DocumentManager.ts
var DocumentManager = class {
  /**
   * Constructs a DocumentManager instance with the specified configuration.
   * @param options Configuration for selecting and initializing the storage provider.
   * @throws {ValidationError} If the provider type is unsupported.
   * @throws {Error} If the S3 provider is selected (not yet implemented).
   */
  constructor(options) {
    if (options.provider === "google_drive" /* GOOGLE_DRIVE */) {
      this.provider = new GoogleDriveProvider(options.config);
    } else if (options.provider === "s3" /* S3 */) {
      throw new Error("S3 provider not yet implemented");
    } else {
      throw new ValidationError(`Unsupported provider: ${options.provider}`);
    }
  }
  /**
   * Creates a new document from the specified source.
   * @param request Details for the document to be created.
   * @returns The created Document object.
   */
  async createDocument(request) {
    return await this.provider.copyDocumentFromSource(request);
  }
  /**
   * Get document by ID
   * @param documentId - The unique identifier of the document.
   * @returns A promise resolving to the found Document object, if it exists.
   */
  async getDocument(documentId) {
    return await this.provider.getDocument(documentId);
  }
  /**
   * Updates a document's name and/or metadata.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - ID of the document to update.
   * @param updates - Object containing the new name and/or metadata to set.
   * @returns The updated Document object.
   */
  async updateDocument(documentId, updates) {
    return await this.provider.updateDocument(documentId, updates);
  }
  /**
   * Deletes a document permanently by its document ID.
   * Always performed as admin (who owns all documents).
   *
   * @param documentId - The unique identifier of the document to delete.
   * @returns A promise that resolves when the document is deleted.
   */
  async deleteDocument(documentId) {
    return await this.provider.deleteDocument(documentId);
  }
  /**
   * Sets the access control (permissions) for a document, replacing all existing permissions.
   *
   * @param documentId - The unique identifier of the document to update permissions for.
   * @param accessControl - An array of AccessControl objects specifying the new permissions.
   * @returns A promise that resolves when permissions are set.
   */
  async setAccessControl(documentId, accessControl) {
    return await this.provider.setPermissions(documentId, accessControl);
  }
  /**
   * Lists or searches for documents matching the provided metadata filters.
   *
   * @param filters - An object containing metadata key-value pairs to filter documents.
   * @param limit - The maximum number of documents to retrieve (default: 20).
   * @param offset - The number of documents to skip before starting to collect the result set (default: 0).
   * @returns A promise that resolves to a SearchDocumentsResult containing the found documents and any pagination info.
   */
  async listDocuments(filters, limit = 20, pageToken) {
    return await this.provider.searchByMetadata(filters, limit, pageToken);
  }
  /**
   * Retrieves comments for a given document, if supported by the provider.
   *
   * @param documentId - The unique identifier of the document to get comments for.
   * @returns A promise that resolves to an array of Comment objects.
   * @throws Error if comments are not supported by the underlying provider.
   */
  async getComments(documentId) {
    if (!this.provider.getComments) {
      throw new Error("Comments not supported by this provider");
    }
    return await this.provider.getComments(documentId);
  }
  /**
   * Retrieves the revision history for a given document, if supported by the provider.
   *
   * @param documentId - The unique identifier of the document to get revisions for.
   * @returns A promise that resolves to an array of Revision objects.
   * @throws Error if revisions are not supported by the underlying provider.
   */
  async getRevisions(documentId) {
    if (!this.provider.getRevisions) {
      throw new Error("Revisions not supported by this provider");
    }
    return await this.provider.getRevisions(documentId);
  }
};

export { DocumentManager, DocumentStorageError, NotFoundError, NotImplementedError, PermissionError, ProviderError, ProviderType, ValidationError };
//# sourceMappingURL=index.mjs.map
//# sourceMappingURL=index.mjs.map