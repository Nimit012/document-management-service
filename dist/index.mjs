import { google } from "googleapis";

//#region src/types/provider.types.ts
/**
* Supported storage provider types
*/
let ProviderType = /* @__PURE__ */ function(ProviderType$1) {
	ProviderType$1["GOOGLE_DRIVE"] = "google_drive";
	ProviderType$1["S3"] = "s3";
	return ProviderType$1;
}({});

//#endregion
//#region src/types/errors.types.ts
/**
* Base error for all library errors
*/
var DocumentStorageError = class DocumentStorageError extends Error {
	constructor(message) {
		super(message);
		this.name = "DocumentStorageError";
		Object.setPrototypeOf(this, DocumentStorageError.prototype);
	}
};
/**
* Provider-specific errors (API failures, etc.)
*/
var ProviderError = class ProviderError extends DocumentStorageError {
	constructor(message, originalError) {
		super(message);
		this.originalError = originalError;
		this.name = "ProviderError";
		Object.setPrototypeOf(this, ProviderError.prototype);
	}
};
/**
* Validation errors (bad input)
*/
var ValidationError = class ValidationError extends DocumentStorageError {
	constructor(message) {
		super(`Validation error: ${message}`);
		this.name = "ValidationError";
		Object.setPrototypeOf(this, ValidationError.prototype);
	}
};
/**
* Resource not found errors
*/
var NotFoundError = class NotFoundError extends DocumentStorageError {
	constructor(resourceType, resourceId) {
		super(`${resourceType} not found: ${resourceId}`);
		this.name = "NotFoundError";
		Object.setPrototypeOf(this, NotFoundError.prototype);
	}
};
/**
* Permission/authorization errors
*/
var PermissionError = class PermissionError extends DocumentStorageError {
	constructor(message) {
		super(`Permission error: ${message}`);
		this.name = "PermissionError";
		Object.setPrototypeOf(this, PermissionError.prototype);
	}
};
/**
* Feature not implemented by provider
*/
var NotImplementedError = class NotImplementedError extends DocumentStorageError {
	constructor(feature, provider) {
		super(`Feature '${feature}' not implemented by provider '${provider}'`);
		this.name = "NotImplementedError";
		Object.setPrototypeOf(this, NotImplementedError.prototype);
	}
};

//#endregion
//#region providers/google-drive/auth.ts
/**
* Google authentication helper for Drive API operations.
*
* Handles authentication and client creation for the Google Drive API
* using a service account with domain-wide delegation.
*
* Key concept: The service account can impersonate any user in the domain
* by setting the 'subject' field in the clientOptions.
*/
var GoogleAuthHelper = class {
	/**
	* Constructs a new GoogleAuthHelper instance.
	* @param config Google Drive configuration with service account credentials.
	*/
	constructor(config) {
		this.serviceAccountKey = config.serviceAccountKey;
		this.adminEmail = config.adminEmail;
		this.scopes = ["https://www.googleapis.com/auth/drive"];
		this.driveClientCache = /* @__PURE__ */ new Map();
		this.validateServiceAccountKey();
	}
	/**
	* Validates that the service account key contains all required fields.
	* @throws {ProviderError} If required fields are missing.
	*/
	validateServiceAccountKey() {
		const missing = ["client_email", "private_key"].filter((field) => !this.serviceAccountKey[field]);
		if (missing.length > 0) throw new ProviderError(`Service account key is missing required fields: ${missing.join(", ")}`);
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
	createAuthClient(impersonateEmail) {
		try {
			return new google.auth.GoogleAuth({
				credentials: this.serviceAccountKey,
				scopes: this.scopes,
				clientOptions: { subject: impersonateEmail }
			});
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
	async createDriveClient(impersonateEmail) {
		if (this.driveClientCache.has(impersonateEmail)) return this.driveClientCache.get(impersonateEmail);
		try {
			const auth = this.createAuthClient(impersonateEmail);
			const driveClient = google.drive({
				version: "v3",
				auth
			});
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
	* @throws {ProviderError} If the client cannot be created.
	* @throws {PermissionError} If authentication fails.
	*/
	async createAdminDriveClient() {
		return this.createDriveClient(this.adminEmail);
	}
	/**
	* Centralized error handling for authentication operations.
	* Distinguishes between configuration errors and permission/authentication errors.
	*
	* @param error - The caught error
	* @param email - The email of the user being authenticated
	* @throws {PermissionError} For authentication/authorization errors
	* @throws {ProviderError} For configuration and other errors
	*/
	_handleAuthError(error, email) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		if (error && typeof error === "object" && "code" in error) {
			if (error.code === 401 || error.code === 403) throw new PermissionError(`Authentication failed for user ${email}. ${errorMessage}. Please verify domain-wide delegation is configured correctly.`);
		}
		const errorMsgLower = errorMessage.toLowerCase();
		if (errorMsgLower.includes("unauthorized") || errorMsgLower.includes("forbidden") || errorMsgLower.includes("access denied") || errorMsgLower.includes("permission") || errorMsgLower.includes("authentication")) throw new PermissionError(`Permission error during authentication for user ${email}: ${errorMessage}`);
		throw new ProviderError(`Failed to create authentication client for user: ${email}. ${errorMessage}`, error);
	}
};

//#endregion
//#region providers/google-drive/operations.ts
/**
* Helper for Google Drive document operations.
*
* This class provides comprehensive document management capabilities for Google Drive:
*  - Copy documents between users with ownership transfer
*  - Set and retrieve document permissions (read, write, comment access)
*  - Create nested folder structures and manage folder hierarchy
*  - Move documents between folders
*  - Handle authentication and impersonation for multi-user operations
*
* All operations are performed using Google Drive API v3 with proper error handling
* and support for domain-wide delegation to manage documents across user accounts.
*/
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
	* @param sourceOwnerEmail Email of the user who owns/can access the source (optional, uses admin if not provided).
	* @param newName Name for the copied document (optional).
	* @returns Copied file metadata as a Drive file object.
	* @throws {NotFoundError} If the source document is not found.
	* @throws {PermissionError} If there are permission issues accessing the source document.
	* @throws {ProviderError} If the copy operation fails.
	*/
	async copyDocument(sourceDocId, sourceOwnerEmail, newName) {
		try {
			return (await (sourceOwnerEmail ? await this.authHelper.createDriveClient(sourceOwnerEmail) : await this.authHelper.createAdminDriveClient()).files.copy({
				fileId: sourceDocId,
				requestBody: { name: newName },
				fields: "id,name,webViewLink,createdTime,modifiedTime,mimeType"
			})).data;
		} catch (error) {
			this._handleError(error, sourceDocId, "copy document");
		}
	}
	/**
	* Get document metadata
	* Always performed as admin
	*
	* @param documentId - Document ID
	* @returns Document metadata
	* @throws {NotFoundError} If the document is not found.
	* @throws {PermissionError} If there are permission issues accessing the document.
	* @throws {ProviderError} If the operation fails for other reasons.
	*/
	async getDocument(documentId) {
		try {
			const response = await (await this.authHelper.createAdminDriveClient()).files.get({
				fileId: documentId,
				fields: "id,name,webViewLink,createdTime,modifiedTime,mimeType,properties"
			});
			if (!response.data) throw new NotFoundError("Document", documentId);
			return response.data;
		} catch (error) {
			this._handleError(error, documentId, "get document");
		}
	}
	/**
	* Update document name
	* Always performed as admin
	*
	* @param documentId - Document ID
	* @param newName - New document name
	* @throws {NotFoundError} If the document is not found.
	* @throws {PermissionError} If there are permission issues updating the document.
	* @throws {ProviderError} If the operation fails for other reasons.
	*/
	async updateName(documentId, newName) {
		try {
			await (await this.authHelper.createAdminDriveClient()).files.update({
				fileId: documentId,
				requestBody: { name: newName }
			});
		} catch (error) {
			this._handleError(error, documentId, "update document name");
		}
	}
	/**
	* Delete document permanently
	* Always performed as admin
	*
	* @param documentId - Document ID
	* @throws {NotFoundError} If the document is not found.
	* @throws {PermissionError} If there are permission issues deleting the document.
	* @throws {ProviderError} If the operation fails for other reasons.
	*/
	async deleteDocument(documentId) {
		try {
			await (await this.authHelper.createAdminDriveClient()).files.delete({ fileId: documentId });
		} catch (error) {
			this._handleError(error, documentId, "delete document");
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
			if (segments.length === 0) throw new ProviderError("Folder path cannot be empty");
			const adminDriveClient = await this.authHelper.createAdminDriveClient();
			let parentId = null;
			for (const folderName of segments) parentId = await this._findOrCreateFolder(adminDriveClient, folderName, parentId);
			return parentId;
		} catch (error) {
			throw new ProviderError(`Failed to create folder path "${path}": ${error instanceof Error ? error.message : "Unknown error"}`, error);
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
		if (existingFolder) return existingFolder;
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
			const queryParts = [
				`name='${folderName.replace(/'/g, "\\'")}'`,
				`mimeType='application/vnd.google-apps.folder'`,
				`trashed=false`
			];
			if (parentId) queryParts.push(`'${parentId}' in parents`);
			else queryParts.push(`'root' in parents`);
			const query = queryParts.join(" and ");
			const folders = (await drive.files.list({
				q: query,
				fields: "files(id,name)",
				pageSize: 1
			})).data.files || [];
			if (folders.length > 0) return folders[0].id;
			return null;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.warn(`  ⚠️ Error searching for folder ${folderName}:`, errorMessage);
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
		if (!response.data || !response.data.id) throw new ProviderError(`Failed to create folder: ${folderName}`);
		return response.data.id;
	}
	/**
	* Moves a document to a specific folder.
	* Removes document from all current parent folders and places in new folder.
	* Always performed as admin.
	*
	* @param fileId The ID of the file to move.
	* @param folderId The ID of the destination folder.
	* @throws {NotFoundError} If the document or folder is not found.
	* @throws {PermissionError} If there are permission issues moving the document.
	* @throws {ProviderError} If the move operation fails for other reasons.
	*/
	async moveToFolder(fileId, folderId) {
		try {
			const adminDriveClient = await this.authHelper.createAdminDriveClient();
			const previousParents = (await adminDriveClient.files.get({
				fileId,
				fields: "parents"
			})).data.parents?.join(",") || "";
			await adminDriveClient.files.update({
				fileId,
				addParents: folderId,
				removeParents: previousParents,
				fields: "id,parents"
			});
		} catch (error) {
			this._handleError(error, fileId, "move document to folder");
		}
	}
	/**
	* Retrieves comments for a document from Google Drive.
	* Always performed as admin (who owns all documents).
	*
	* @param documentId - The unique identifier of the document.
	* @returns A promise resolving to an array of Comment objects.
	* @throws {NotFoundError} If the document is not found.
	* @throws {PermissionError} If there are permission issues accessing comments.
	* @throws {ProviderError} If the operation fails for other reasons.
	*/
	async getComments(documentId) {
		try {
			return ((await (await this.authHelper.createAdminDriveClient()).comments.list({
				fileId: documentId,
				fields: "comments(id,content,author,createdTime,resolved,replies)"
			})).data.comments || []).map((comment) => ({
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
			this._handleError(error, documentId, "get comments for document");
		}
	}
	/**
	* Retrieves revisions for a document from Google Drive.
	* Always performed as admin (who owns all documents).
	*
	* @param documentId - The unique identifier of the document.
	* @returns A promise resolving to an array of Revision objects.
	* @throws {NotFoundError} If the document is not found.
	* @throws {PermissionError} If there are permission issues accessing revisions.
	* @throws {ProviderError} If the operation fails for other reasons.
	*/
	async getRevisions(documentId) {
		try {
			return ((await (await this.authHelper.createAdminDriveClient()).revisions.list({
				fileId: documentId,
				fields: "revisions(id,modifiedTime,lastModifyingUser,exportLinks)"
			})).data.revisions || []).map((rev) => ({
				revision_id: rev.id,
				modified_time: rev.modifiedTime,
				modified_by: rev.lastModifyingUser?.emailAddress || "Unknown",
				export_links: rev.exportLinks || void 0
			}));
		} catch (error) {
			this._handleError(error, documentId, "get revisions for document");
		}
	}
	/**
	* Centralized error handling for document operations.
	* Distinguishes between different error types and throws appropriate errors.
	*
	* @param error - The caught error
	* @param documentId - The document ID related to the error
	* @param operation - Description of the operation that failed
	* @throws {PermissionError} For 403 Forbidden errors
	* @throws {NotFoundError} For 404 Not Found errors
	* @throws {ProviderError} For all other errors
	*/
	_handleError(error, documentId, operation) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		if (error instanceof NotFoundError) throw error;
		if (error && typeof error === "object" && "code" in error) {
			if (error.code === 403) throw new PermissionError(`Permission denied: Failed to ${operation} ${documentId}. ${errorMessage}`);
			if (error.code === 404) throw new NotFoundError("Document", documentId);
		}
		throw new ProviderError(`Failed to ${operation} ${documentId}: ${errorMessage}`, error);
	}
};

//#endregion
//#region providers/google-drive/permissions.ts
/**
* Permission management for Google Drive documents.
*
* Handles ownership transfers and permission settings for documents.
*/
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
	* @param sourceOwnerEmail Email of the current document owner (optional, skips transfer if not provided).
	* @param fileId The ID of the file to transfer ownership of.
	* @throws {ProviderError} If the ownership transfer fails.
	* @throws {PermissionError} If there are permission issues during transfer.
	* @throws {NotFoundError} If the document is not found.
	*/
	async transferToAdmin(sourceOwnerEmail, fileId) {
		try {
			if (!sourceOwnerEmail) return;
			const adminEmail = this.authHelper.getAdminEmail();
			await (await this.authHelper.createDriveClient(sourceOwnerEmail)).permissions.create({
				fileId,
				requestBody: {
					role: "owner",
					type: "user",
					emailAddress: adminEmail
				},
				transferOwnership: true
			});
			const adminDriveClient = await this.authHelper.createAdminDriveClient();
			const teacherPermission = (await adminDriveClient.permissions.list({
				fileId,
				fields: "permissions(id,emailAddress,role)"
			})).data.permissions?.find((p) => p.emailAddress === sourceOwnerEmail);
			if (teacherPermission?.id) await adminDriveClient.permissions.delete({
				fileId,
				permissionId: teacherPermission.id
			});
		} catch (error) {
			this._handleError(error, fileId, "transfer ownership to admin");
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
	* @throws {PermissionError} If permission operations fail due to authorization issues.
	* @throws {NotFoundError} If the document is not found.
	* @throws {ProviderError} If the operation fails for other reasons.
	*/
	async setPermissions(documentId, accessControl) {
		try {
			const adminDriveClient = await this.authHelper.createAdminDriveClient();
			const permissions = (await adminDriveClient.permissions.list({
				fileId: documentId,
				fields: "permissions(id,role,emailAddress,type)"
			})).data.permissions || [];
			for (const permission of permissions) {
				if (permission.role === "owner") continue;
				if (permission.id) try {
					await adminDriveClient.permissions.delete({
						fileId: documentId,
						permissionId: permission.id
					});
				} catch (error) {
					console.warn(`Failed to remove permission ${permission.id}:`, error);
				}
			}
			for (const ac of accessControl) {
				const role = this._mapAccessLevelToRole(ac.access_level);
				try {
					await adminDriveClient.permissions.create({
						fileId: documentId,
						requestBody: {
							role,
							type: "user",
							emailAddress: ac.user
						},
						sendNotificationEmail: false
					});
				} catch (error) {
					if (error && typeof error === "object" && "code" in error && error.code === 403) {
						const errorMessage = error instanceof Error ? error.message : "Unknown error";
						throw new PermissionError(`Failed to grant ${ac.access_level} access to user ${ac.user} on document ${documentId}: ${errorMessage}`);
					}
					throw error;
				}
			}
		} catch (error) {
			this._handleError(error, documentId, "set permissions on document");
		}
	}
	/**
	* Get current permissions on a document
	* Excludes owner permission
	* Always performed as admin
	*
	* @param documentId - Document ID
	* @returns Array of access control rules
	* @throws {PermissionError} If there are permission issues accessing the document.
	* @throws {NotFoundError} If the document is not found.
	* @throws {ProviderError} If the operation fails for other reasons.
	*/
	async getPermissions(documentId) {
		try {
			return ((await (await this.authHelper.createAdminDriveClient()).permissions.list({
				fileId: documentId,
				fields: "permissions(id,role,emailAddress,type)"
			})).data.permissions || []).filter((p) => p.role !== "owner" && p.emailAddress).map((p) => ({
				user: p.emailAddress,
				access_level: this._mapRoleToAccessLevel(p.role)
			}));
		} catch (error) {
			this._handleError(error, documentId, "get permissions for document");
		}
	}
	/**
	* Map our access level to Google Drive role
	*
	* @param accessLevel - Our access level (read, read_write, comment)
	* @returns Google Drive role (reader, writer, commenter)
	*/
	_mapAccessLevelToRole(accessLevel) {
		const role = {
			read: "reader",
			read_write: "writer",
			comment: "commenter"
		}[accessLevel];
		if (!role) throw new ProviderError(`Invalid access level: ${accessLevel}. Must be read, read_write, or comment`);
		return role;
	}
	/**
	* Map Google Drive role to our access level
	*
	* @param role - Google Drive role (reader, writer, commenter)
	* @returns Our access level (read, read_write, comment)
	*/
	_mapRoleToAccessLevel(role) {
		return {
			reader: "read",
			writer: "read_write",
			commenter: "comment"
		}[role] || "read";
	}
	/**
	* Centralized error handling for permission operations.
	* Distinguishes between different error types and throws appropriate errors.
	*
	* @param error - The caught error
	* @param documentId - The document ID related to the error
	* @param operation - Description of the operation that failed
	* @throws {PermissionError} For 403 Forbidden errors
	* @throws {NotFoundError} For 404 Not Found errors
	* @throws {ProviderError} For all other errors
	*/
	_handleError(error, documentId, operation) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		if (error && typeof error === "object" && "code" in error) {
			if (error.code === 403) throw new PermissionError(`Permission denied: Failed to ${operation} ${documentId}. ${errorMessage}`);
			if (error.code === 404) throw new NotFoundError("Document", documentId);
		}
		throw new ProviderError(`Failed to ${operation} ${documentId}: ${errorMessage}`, error);
	}
};

//#endregion
//#region providers/google-drive/metadata.ts
/**
* Metadata management for Google Drive documents.
*
* Handles retrieval and updates of document metadata.
*/
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
	* @throws {NotFoundError} If the document is not found.
	* @throws {PermissionError} If there are permission issues updating metadata.
	* @throws {ProviderError} If the operation fails for other reasons.
	*/
	async setMetadata(documentId, metadata) {
		try {
			const adminDriveClient = await this.authHelper.createAdminDriveClient();
			const properties = {};
			for (const [key, value] of Object.entries(metadata)) if (value === null || value === void 0) properties[key] = "";
			else if (typeof value === "string") properties[key] = value;
			else properties[key] = JSON.stringify(value);
			await adminDriveClient.files.update({
				fileId: documentId,
				requestBody: { properties },
				fields: "properties"
			});
		} catch (error) {
			this._handleError(error, documentId, "set metadata on document");
		}
	}
	/**
	* Get custom metadata from a document
	* Always performed as admin
	*
	* @param documentId - Document ID
	* @returns Metadata object (with values parsed back from strings)
	* @throws {NotFoundError} If the document is not found.
	* @throws {PermissionError} If there are permission issues accessing metadata.
	* @throws {ProviderError} If the operation fails for other reasons.
	*/
	async getMetadata(documentId) {
		try {
			const properties = (await (await this.authHelper.createAdminDriveClient()).files.get({
				fileId: documentId,
				fields: "properties"
			})).data.properties || {};
			const metadata = {};
			for (const [key, value] of Object.entries(properties)) if (value === "") metadata[key] = null;
			else try {
				metadata[key] = JSON.parse(value);
			} catch {
				metadata[key] = value;
			}
			return metadata;
		} catch (error) {
			this._handleError(error, documentId, "get metadata for document");
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
	* @throws {PermissionError} If there are permission issues performing the search.
	* @throws {ProviderError} If the search operation fails.
	*/
	async searchByMetadata(filters, limit = 20, pageToken) {
		try {
			if (limit < 1 || limit > 100) throw new ProviderError("Limit must be between 1 and 100");
			const adminDrive = await this.authHelper.createAdminDriveClient();
			const queryParts = [];
			for (const [key, value] of Object.entries(filters)) {
				let stringValue;
				if (value === null || value === void 0) stringValue = "";
				else if (typeof value === "string") stringValue = value;
				else stringValue = JSON.stringify(value);
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
				orderBy: "modifiedTime desc"
			});
			const files = response.data.files || [];
			const nextPageToken = response.data.nextPageToken;
			return {
				documents: files.map((file) => this._toDocumentObject(file)),
				nextPageToken,
				limit
			};
		} catch (error) {
			if (error instanceof ProviderError) throw error;
			throw new ProviderError(`Failed to search documents by metadata: ${error instanceof Error ? error.message : "Unknown error"}`, error);
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
			for (const [key, value] of Object.entries(file.properties)) if (value !== null && value !== void 0) try {
				metadata[key] = JSON.parse(value);
			} catch {
				metadata[key] = value;
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
	/**
	* Centralized error handling for metadata operations.
	* Distinguishes between different error types and throws appropriate errors.
	*
	* @param error - The caught error
	* @param documentId - The document ID related to the error
	* @param operation - Description of the operation that failed
	* @throws {PermissionError} For 403 Forbidden errors
	* @throws {NotFoundError} For 404 Not Found errors
	* @throws {ProviderError} For all other errors
	*/
	_handleError(error, documentId, operation) {
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		if (error instanceof NotFoundError || error instanceof ProviderError) throw error;
		if (error && typeof error === "object" && "code" in error) {
			if (error.code === 403) throw new PermissionError(`Permission denied: Failed to ${operation} ${documentId}. ${errorMessage}`);
			if (error.code === 404) throw new NotFoundError("Document", documentId);
		}
		throw new ProviderError(`Failed to ${operation} ${documentId}: ${errorMessage}`, error);
	}
};

//#endregion
//#region providers/google-drive/GoogleDriveProvider.ts
/**
* Google Drive Storage Provider implementation.
*
* Implements the {@link IStorageProvider} interface for Google Drive.
* Orchestrates authentication, document operations, permissions, and metadata
* to provide complete document management functionality.
*/
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
	* @param request The document creation request, including source reference, optional owner (defaults to 'admin'), name, folder path, access control, and metadata.
	* @returns The created Document object.
	* @throws {ProviderError} If any step fails during the process.
	*/
	async copyDocumentFromSource(request) {
		try {
			const copiedFile = await this.operations.copyDocument(request.source_reference, request.source_owner, request.name);
			await this.permissions.transferToAdmin(request.source_owner, copiedFile.id);
			if (request.folder_path) {
				const folderId = await this.operations.createPath(request.folder_path);
				await this.operations.moveToFolder(copiedFile.id, folderId);
			}
			if (request.access_control && request.access_control.length > 0) await this.permissions.setPermissions(copiedFile.id, request.access_control);
			if (request.metadata) await this.metadata.setMetadata(copiedFile.id, request.metadata);
			return this._toDocumentObject(copiedFile);
		} catch (error) {
			throw new ProviderError(`Failed to create document: ${error instanceof Error ? error.message : "Unknown error"}`, error);
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
			if (updates.name) await this.operations.updateName(documentId, updates.name);
			if (updates.metadata) {
				const mergedMetadata = {
					...await this.metadata.getMetadata(documentId),
					...updates.metadata
				};
				await this.metadata.setMetadata(documentId, mergedMetadata);
			}
			return await this.getDocument(documentId);
		} catch (error) {
			throw new ProviderError(`Failed to update document: ${error instanceof Error ? error.message : "Unknown error"}`, error);
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
	/**
	* Converts a Google Drive file object to the internal Document format.
	*
	* @param file The Google Drive file to convert.
	* @returns The corresponding Document object.
	*/
	_toDocumentObject(file) {
		const metadata = {};
		if (file.properties) {
			for (const [key, value] of Object.entries(file.properties)) if (value !== null && value !== void 0) try {
				metadata[key] = JSON.parse(value);
			} catch {
				metadata[key] = value;
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

//#endregion
//#region src/DocumentManager.ts
/**
* Main facade class providing a unified interface for document operations.
* Automatically instantiates the correct storage provider based on configuration.
*/
var DocumentManager = class {
	/**
	* Constructs a DocumentManager instance with the specified configuration.
	* @param options Configuration for selecting and initializing the storage provider.
	* @throws {ValidationError} If the provider type is unsupported or configuration is invalid.
	*/
	constructor(options) {
		if (!options) throw new ValidationError("Configuration options are required");
		if (!options.provider) throw new ValidationError("Provider type is required");
		if (!options.config) throw new ValidationError("Provider configuration is required");
		if (options.provider === ProviderType.GOOGLE_DRIVE) this.provider = new GoogleDriveProvider(options.config);
		else if (options.provider === ProviderType.S3) throw new Error("S3 provider not yet implemented");
		else throw new ValidationError(`Unsupported provider: ${options.provider}`);
	}
	/**
	* Creates a new document from the specified source.
	* @param request Details for the document to be created.
	* @returns The created Document object.
	* @throws {ValidationError} If source_reference is missing or invalid.
	*/
	async createDocument(request) {
		if (!request) throw new ValidationError("Request object is required");
		if (!request.source_reference || typeof request.source_reference !== "string" || request.source_reference.trim() === "") throw new ValidationError("source_reference is required and cannot be empty");
		if (request.source_owner !== void 0) {
			if (typeof request.source_owner !== "string" || request.source_owner.trim() === "") throw new ValidationError("source_owner must be a non-empty email string");
			if (!this._isValidEmail(request.source_owner)) throw new ValidationError(`Invalid email format for source_owner: ${request.source_owner}`);
		}
		if (request.name !== void 0) {
			if (typeof request.name !== "string") throw new ValidationError("name must be a string");
		}
		if (request.folder_path !== void 0) {
			if (typeof request.folder_path !== "string" || request.folder_path.trim() === "") throw new ValidationError("folder_path must be a non-empty string");
		}
		if (request.access_control) this._validateAccessControl(request.access_control);
		if (request.metadata !== void 0) this._validateMetadata(request.metadata);
		return await this.provider.copyDocumentFromSource(request);
	}
	/**
	* Get document by ID
	* @param documentId - The unique identifier of the document.
	* @returns A promise resolving to the found Document object, if it exists.
	* @throws {ValidationError} If documentId is missing or invalid.
	*/
	async getDocument(documentId) {
		this._validateDocumentId(documentId);
		return await this.provider.getDocument(documentId);
	}
	/**
	* Updates a document's name and/or metadata.
	* Always performed as admin (who owns all documents).
	*
	* @param documentId - ID of the document to update.
	* @param updates - Object containing the new name and/or metadata to set.
	* @returns The updated Document object.
	* @throws {ValidationError} If documentId or updates are invalid.
	*/
	async updateDocument(documentId, updates) {
		this._validateDocumentId(documentId);
		if (!updates) throw new ValidationError("Updates object is required");
		const hasName = updates.name !== void 0;
		const hasMetadata = updates.metadata !== void 0;
		if (!hasName && !hasMetadata) throw new ValidationError("At least one of name or metadata must be provided for update");
		if (hasName && (typeof updates.name !== "string" || updates.name.trim() === "")) throw new ValidationError("name must be a non-empty string");
		if (hasMetadata && updates.metadata !== void 0) this._validateMetadata(updates.metadata);
		return await this.provider.updateDocument(documentId, updates);
	}
	/**
	* Deletes a document permanently by its document ID.
	* Always performed as admin (who owns all documents).
	*
	* @param documentId - The unique identifier of the document to delete.
	* @returns A promise that resolves when the document is deleted.
	* @throws {ValidationError} If documentId is missing or invalid.
	*/
	async deleteDocument(documentId) {
		this._validateDocumentId(documentId);
		return await this.provider.deleteDocument(documentId);
	}
	/**
	* Sets the access control (permissions) for a document, replacing all existing permissions.
	*
	* @param documentId - The unique identifier of the document to update permissions for.
	* @param accessControl - An array of AccessControl objects specifying the new permissions.
	* @returns A promise that resolves when permissions are set.
	* @throws {ValidationError} If documentId or accessControl are invalid.
	*/
	async setAccessControl(documentId, accessControl) {
		this._validateDocumentId(documentId);
		this._validateAccessControl(accessControl);
		return await this.provider.setPermissions(documentId, accessControl);
	}
	/**
	* Lists or searches for documents matching the provided metadata filters.
	*
	* @param filters - An object containing metadata key-value pairs to filter documents.
	* @param limit - The maximum number of documents to retrieve (default: 20).
	* @param pageToken - Optional token for pagination (obtained from previous search).
	* @returns A promise that resolves to a SearchDocumentsResult containing the found documents and any pagination info.
	* @throws {ValidationError} If limit is invalid or filters are not an object.
	*/
	async listDocuments(filters, limit = 20, pageToken) {
		if (filters === null || filters === void 0) throw new ValidationError("filters must be an object");
		if (typeof filters !== "object" || Array.isArray(filters)) throw new ValidationError("filters must be an object, not an array or null");
		if (!Number.isInteger(limit) || limit < 1) throw new ValidationError("limit must be a positive integer (at least 1)");
		if (limit > 100) throw new ValidationError("limit must not exceed 100");
		if (pageToken !== void 0) {
			if (typeof pageToken !== "string" || pageToken.trim() === "") throw new ValidationError("pageToken must be a non-empty string");
		}
		return await this.provider.searchByMetadata(filters, limit, pageToken);
	}
	/**
	* Retrieves comments for a given document, if supported by the provider.
	*
	* @param documentId - The unique identifier of the document to get comments for.
	* @returns A promise that resolves to an array of Comment objects.
	* @throws {ValidationError} If documentId is invalid.
	* @throws {NotImplementedError} If comments are not supported by the provider.
	*/
	async getComments(documentId) {
		this._validateDocumentId(documentId);
		if (!this.provider.getComments) throw new NotImplementedError("Comments", this.constructor.name);
		return await this.provider.getComments(documentId);
	}
	/**
	* Retrieves the revision history for a given document, if supported by the provider.
	*
	* @param documentId - The unique identifier of the document to get revisions for.
	* @returns A promise that resolves to an array of Revision objects.
	* @throws {ValidationError} If documentId is invalid.
	* @throws {NotImplementedError} If revisions are not supported by the provider.
	*/
	async getRevisions(documentId) {
		this._validateDocumentId(documentId);
		if (!this.provider.getRevisions) throw new NotImplementedError("Revisions", this.constructor.name);
		return await this.provider.getRevisions(documentId);
	}
	/**
	* Validates that a documentId is non-empty and properly formatted.
	* @param documentId - The document ID to validate.
	* @throws {ValidationError} If the documentId is invalid.
	*/
	_validateDocumentId(documentId) {
		if (!documentId || typeof documentId !== "string" || documentId.trim() === "") throw new ValidationError("documentId is required and cannot be empty");
	}
	/**
	* Validates an array of AccessControl objects.
	* @param accessControl - The access control array to validate.
	* @throws {ValidationError} If the access control array or any entry is invalid.
	*/
	_validateAccessControl(accessControl) {
		if (!Array.isArray(accessControl)) throw new ValidationError("accessControl must be an array");
		if (accessControl.length === 0) throw new ValidationError("accessControl array cannot be empty");
		const validAccessLevels = [
			"read",
			"read_write",
			"comment"
		];
		for (let i = 0; i < accessControl.length; i++) {
			const ac = accessControl[i];
			if (!ac || typeof ac !== "object") throw new ValidationError(`accessControl[${i}] must be an object`);
			if (!ac.user || typeof ac.user !== "string" || ac.user.trim() === "") throw new ValidationError(`accessControl[${i}].user must be a non-empty email string`);
			if (!this._isValidEmail(ac.user)) throw new ValidationError(`Invalid email format for accessControl[${i}].user: ${ac.user}`);
			if (!ac.access_level || typeof ac.access_level !== "string") throw new ValidationError(`accessControl[${i}].access_level must be a string`);
			if (!validAccessLevels.includes(ac.access_level)) throw new ValidationError(`accessControl[${i}].access_level must be one of: ${validAccessLevels.join(", ")}`);
		}
	}
	/**
	* Validates metadata object structure.
	* @param metadata - The metadata to validate.
	* @throws {ValidationError} If metadata is not a valid object.
	*/
	_validateMetadata(metadata) {
		if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new ValidationError("metadata must be an object");
		for (const [key, value] of Object.entries(metadata)) {
			if (typeof key !== "string" || key.trim() === "") throw new ValidationError("Metadata keys must be non-empty strings");
			if (value === void 0) throw new ValidationError(`Metadata value for key '${key}' cannot be undefined. Use null instead.`);
			if (typeof value === "function") throw new ValidationError(`Metadata value for key '${key}' cannot be a function`);
		}
	}
	/**
	* Validates if a string is a valid email format.
	* @param email - The email string to validate.
	* @returns True if the email is valid, false otherwise.
	*/
	_isValidEmail(email) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}
};

//#endregion
export { DocumentManager, DocumentStorageError, NotFoundError, NotImplementedError, PermissionError, ProviderError, ProviderType, ValidationError };