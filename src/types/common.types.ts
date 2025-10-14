/**
 * Core document type returned by all operations
 */
export interface Document {
    document_id: string;
    provider: string;
    storage_reference: string;
    name: string;
    access_url: string;
    folder_path?: string;
    created_at: string;
    updated_at?: string;
    metadata?: Record<string, any>;
  }
  

  /**
 * Request to create a new document by copying from source
 */
export interface CreateDocumentRequest {
  provider: 'google_drive' | 's3';
  source_reference: string;
  source_owner: string; // Email of user who owns/can access the source document
  name?: string;
  folder_path?: string;
  access_control?: AccessControl[];
  metadata?: Record<string, any>;
}
  
  /**
   * Access control rule for document permissions
   */
  export interface AccessControl {
    user: string; // Email address
    access_level: 'read' | 'read_write' | 'comment';
  }
  
  /**
   * Document revision (Google Drive specific)
   */
  export interface Revision {
    revision_id: string;
    modified_time: string;
    modified_by: string;
    export_links?: Record<string, string>;
  }
  
  /**
   * Document comment (Google Drive specific)
   */
  export interface Comment {
    comment_id: string;
    author: string;
    content: string;
    created_at: string;
    resolved: boolean;
    replies?: CommentReply[];
  }
  
  export interface CommentReply {
    reply_id: string;
    author: string;
    content: string;
    created_at: string;
  }
  
  /**
   * Search/list parameters
   */
  export interface SearchDocumentsParams {
    filters?: Record<string, any>;
    limit?: number;
    offset?: number;
  }
  
  /**
   * Search results with pagination
   */
  export interface SearchDocumentsResult {
    documents: Document[];
    total: number;
    limit: number;
    offset: number;
  }