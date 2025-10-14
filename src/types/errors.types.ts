/**
 * Base error for all library errors
 */
export class DocumentStorageError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DocumentStorageError';
      Object.setPrototypeOf(this, DocumentStorageError.prototype);
    }
  }
  
  /**
   * Provider-specific errors (API failures, etc.)
   */
  export class ProviderError extends DocumentStorageError {
    constructor(message: string, public originalError?: any) {
      super(message);
      this.name = 'ProviderError';
      Object.setPrototypeOf(this, ProviderError.prototype);
    }
  }
  
  /**
   * Validation errors (bad input)
   */
  export class ValidationError extends DocumentStorageError {
    constructor(message: string) {
      super(`Validation error: ${message}`);
      this.name = 'ValidationError';
      Object.setPrototypeOf(this, ValidationError.prototype);
    }
  }
  
  /**
   * Resource not found errors
   */
  export class NotFoundError extends DocumentStorageError {
    constructor(resourceType: string, resourceId: string) {
      super(`${resourceType} not found: ${resourceId}`);
      this.name = 'NotFoundError';
      Object.setPrototypeOf(this, NotFoundError.prototype);
    }
  }
  
  /**
   * Permission/authorization errors
   */
  export class PermissionError extends DocumentStorageError {
    constructor(message: string) {
      super(`Permission error: ${message}`);
      this.name = 'PermissionError';
      Object.setPrototypeOf(this, PermissionError.prototype);
    }
  }
  
  /**
   * Feature not implemented by provider
   */
  export class NotImplementedError extends DocumentStorageError {
    constructor(feature: string, provider: string) {
      super(`Feature '${feature}' not implemented by provider '${provider}'`);
      this.name = 'NotImplementedError';
      Object.setPrototypeOf(this, NotImplementedError.prototype);
    }
  }