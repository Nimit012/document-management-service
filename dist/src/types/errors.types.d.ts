/**
 * Base error for all library errors
 */
export declare class DocumentStorageError extends Error {
    constructor(message: string);
}
/**
 * Provider-specific errors (API failures, etc.)
 */
export declare class ProviderError extends DocumentStorageError {
    originalError?: any | undefined;
    constructor(message: string, originalError?: any | undefined);
}
/**
 * Validation errors (bad input)
 */
export declare class ValidationError extends DocumentStorageError {
    constructor(message: string);
}
/**
 * Resource not found errors
 */
export declare class NotFoundError extends DocumentStorageError {
    constructor(resourceType: string, resourceId: string);
}
/**
 * Permission/authorization errors
 */
export declare class PermissionError extends DocumentStorageError {
    constructor(message: string);
}
/**
 * Feature not implemented by provider
 */
export declare class NotImplementedError extends DocumentStorageError {
    constructor(feature: string, provider: string);
}
