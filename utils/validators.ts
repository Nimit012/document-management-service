import {
  CreateDocumentRequest,
  AccessControl,
  ValidationError,
} from '../src/types/index.js';  // Add .js extension for ES modules

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate CreateDocumentRequest structure
 */
export function validateCreateRequest(request: CreateDocumentRequest): void {
  if (!request.provider) {
    throw new ValidationError('provider is required');
  }

  if (!['google_drive', 's3'].includes(request.provider)) {
    throw new ValidationError('provider must be "google_drive" or "s3"');
  }

  if (!request.source_reference) {
    throw new ValidationError('source_reference is required');
  }

  if (typeof request.source_reference !== 'string' || request.source_reference.trim() === '') {
    throw new ValidationError('source_reference must be a non-empty string');
  }

  if (!request.source_owner) {
    throw new ValidationError('source_owner is required');
  }

  if (!isValidEmail(request.source_owner)) {
    throw new ValidationError('source_owner must be a valid email address');
  }

  if (request.name !== undefined && typeof request.name !== 'string') {
    throw new ValidationError('name must be a string');
  }

  if (request.folder_path !== undefined && typeof request.folder_path !== 'string') {
    throw new ValidationError('folder_path must be a string');
  }

  if (request.access_control !== undefined) {
    if (!Array.isArray(request.access_control)) {
      throw new ValidationError('access_control must be an array');
    }
    validateAccessControl(request.access_control);
  }

  if (request.metadata !== undefined) {
    if (typeof request.metadata !== 'object' || request.metadata === null) {
      throw new ValidationError('metadata must be an object');
    }
  }
}

/**
 * Validate access control array
 */
export function validateAccessControl(accessControl: AccessControl[]): void {
  if (!Array.isArray(accessControl)) {
    throw new ValidationError('access_control must be an array');
  }

  for (let i = 0; i < accessControl.length; i++) {
    const ac = accessControl[i];

    if (!ac.user) {
      throw new ValidationError(`access_control[${i}].user is required`);
    }

    if (!isValidEmail(ac.user)) {
      throw new ValidationError(`access_control[${i}].user must be a valid email address`);
    }

    if (!ac.access_level) {
      throw new ValidationError(`access_control[${i}].access_level is required`);
    }

    if (!['read', 'read_write', 'comment'].includes(ac.access_level)) {
      throw new ValidationError(
        `access_control[${i}].access_level must be "read", "read_write", or "comment"`
      );
    }
  }
}

/**
 * Validate document ID format
 */
export function validateDocumentId(documentId: string): void {
  if (!documentId) {
    throw new ValidationError('document_id is required');
  }

  if (typeof documentId !== 'string' || documentId.trim() === '') {
    throw new ValidationError('document_id must be a non-empty string');
  }
}

/**
 * Validate metadata object
 */
export function validateMetadata(metadata: Record<string, any>): void {
  if (typeof metadata !== 'object' || metadata === null) {
    throw new ValidationError('metadata must be an object');
  }

  // Check that values are serializable (strings, numbers, booleans)
  for (const [key, value] of Object.entries(metadata)) {
    const type = typeof value;
    if (!['string', 'number', 'boolean'].includes(type) && value !== null) {
      throw new ValidationError(
        `metadata.${key} must be a string, number, boolean, or null (got ${type})`
      );
    }
  }
}