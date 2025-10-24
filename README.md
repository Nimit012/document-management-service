# Document Management Service

The Document Based Student Activity Engine is a standalone microservice that provides document management capabilities for activities (Google Doc, Hosted on S3). It is designed to be LMS-agnostic and focuses solely on the lifecycle management of documents used in student activities.

## What It Does

This service lets you programmatically manage documents across cloud providers with a single, unified interface. Built for educational platforms and enterprise environments where you need to handle document operations at scale.

**Key capabilities:**
- Copy documents from any user in your domain
- Transfer ownership to administrators or other users
- Set granular permissions (read, write, comment)
- Organize documents in folder structures
- Add and search by custom metadata
- Handle pagination for large document sets

## How It Works

The service uses **domain-wide delegation** to act on behalf of any user in your organization. It enables document-based learning workflows where content flows between teachers and students.

### Typical Workflow This Service Enables

1. **Teachers create activity content** - Teachers independently create document-based activities (exercises, assignments, tests) in their own Drive
2. **Students get copies** - Students receive copies of the activity document to work on
3. **Students complete work** - Students update sections, create additional content, and complete the exercise in their copy
4. **Students submit** - Students share their completed document with the teacher for evaluation
5. **Teachers provide feedback** - Teachers review submissions and provide comments or request revisions
6. **Revision cycle** - Students can revise and resubmit based on teacher feedback
7. **Final submission** - Once satisfied, teachers tag the last revision for final grading

## Installation

```bash
npm install git+https://github.com/yourusername/doc-management-service.git
```

## Architecture

The service uses a modular, provider-agnostic design:

```
DocumentManager (Unified Interface)
    ↓
Provider Selection (Google Drive, S3, etc.)
    ↓
┌─────────────────────────────────┐
│   Provider Implementation       │
│   • Authentication              │
│   • Document Operations         │
│   • Permission Management       │
│   • Metadata Handling           │
└─────────────────────────────────┘
    ↓
Cloud Provider API (Google Drive API, AWS S3 API)
```

Each provider is self-contained with its own authentication, operations, and permission handling. This makes it easy to add new storage providers without changing your application code.

## Basic Usage

```typescript
import { DocumentManager, ProviderType, GoogleDriveConfig } from 'document-management-service';

// Configure
const config: GoogleDriveConfig = {
  serviceAccountKey: {
    type: "service_account",
    project_id: "your-project-id",
    private_key: "-----BEGIN PRIVATE KEY-----\n...",
    client_email: "service-account@project.iam.gserviceaccount.com",
    // ... other service account fields
  },
  adminEmail: "admin@yourdomain.com"
};

// Initialize
const docManager = new DocumentManager({
  provider: ProviderType.GOOGLE_DRIVE,
  config: config
});

// Create a document (copy + transfer ownership + set permissions)
const document = await docManager.createDocument({
  source_reference: 'google-drive-file-id',
  source_owner: 'teacher@yourdomain.com',
  name: 'Student Assignment Copy',
  folder_path: 'Course Materials/Week 1',
  access_control: [
    { user: 'student@yourdomain.com', access_level: 'read' }
  ],
  metadata: {
    course: 'Math 101',
    week: 1
  }
});

// Get document info
const doc = await docManager.getDocument(document.id);

// Update permissions
await docManager.setAccessControl(document.id, [
  { user: 'grader@yourdomain.com', access_level: 'read_write' }
]);

// Search by metadata
const results = await docManager.listDocuments({
  metadata: { course: 'Math 101' },
  limit: 20
});
```

## Configuration

### Google Drive Configuration

```typescript
const config: GoogleDriveConfig = {
  serviceAccountKey: {
    type: "service_account",
    project_id: "your-project-id",
    private_key_id: "your-private-key-id",
    private_key: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    client_email: "service-account@project.iam.gserviceaccount.com",
    client_id: "your-client-id",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/..."
  },
  adminEmail: "admin@yourdomain.com"  // Admin account for ownership transfers
};
```

## Error Handling

The service uses a hierarchical error system for precise error handling:

```typescript
import { 
  NotFoundError,      // Document or resource not found
  ProviderError,      // Cloud provider API errors
  ValidationError,    // Invalid input parameters
  PermissionError     // Authorization/access issues
} from 'document-management-service';

try {
  const doc = await documentManager.createDocument({ /* ... */ });
} catch (error) {
  if (error instanceof NotFoundError) {
    console.error('Document not found or user lacks access');
  } else if (error instanceof PermissionError) {
    console.error('Insufficient permissions:', error.message);
  } else if (error instanceof ProviderError) {
    console.error('Google Drive API error:', error.message);
    // Access original error: error.originalError
  } else if (error instanceof ValidationError) {
    console.error('Invalid input:', error.message);
  }
}
```

**Common scenarios:**
- **404 errors** → Document not found or user doesn't have access
- **403 errors** → Insufficient permissions or domain-wide delegation not configured
- **400 errors** → Invalid parameters or malformed service account key
- **Rate limiting** → API quota exceeded (handled automatically with retries)

## API Reference

### createDocument(request)

Copies a document from a source user, transfers ownership to admin, and sets up permissions/metadata in a single operation.

```typescript
await docManager.createDocument({
  source_reference: string,      // Google Drive file ID to copy from
  source_owner: string,          // Optional: Email of the source document owner (defaults to admin)
  name?: string,                 // Optional: new name for the copied document
  folder_path?: string,          // Optional: folder path (e.g., 'Course/Week1')
  access_control?: Array<{       // Optional: set initial permissions
    user: string,                // User email
    access_level: 'read' | 'read_write' | 'comment'
  }>,
  metadata?: Record<string, any> // Optional: custom properties for search/filtering
});
```

**Returns:** `Document` object with `id`, `name`, `storage_reference`, `owner`, `created_at`, `updated_at`, and `metadata`.

**Use case:** Perfect for copying template documents to students, creating personalized assignments, or duplicating shared resources.

---

### getDocument(documentId)

Retrieves full information about a document.

```typescript
await docManager.getDocument(documentId: string);
```

**Returns:** `Document` object with all metadata and properties.

**Throws:** `NotFoundError` if document doesn't exist or user lacks access.

---

### updateDocument(documentId, updates)

Updates a document's name or metadata. Does not modify content.

```typescript
await docManager.updateDocument(documentId: string, {
  name?: string,                 // New document name
  metadata?: Record<string, any> // Update or add metadata properties
});
```

**Returns:** Updated `Document` object.

**Note:** Only updates the fields you provide. Existing metadata is merged, not replaced.

---

### deleteDocument(documentId)

Permanently deletes a document from storage.

```typescript
await docManager.deleteDocument(documentId: string);
```

**Returns:** `void`

**Warning:** This action is irreversible. The document is permanently deleted from the cloud provider.

**Use case:** Clean up draft documents, remove outdated materials, or delete documents after a course ends.

---

### setAccessControl(documentId, accessControl)

Sets or updates user permissions on a document. Replaces existing permissions.

```typescript
await docManager.setAccessControl(documentId: string, [
  {
    user: string,                // User email address
    access_level: 'read' | 'read_write' | 'comment'
  }
]);
```

**Access levels:**
- `read`: Can view the document
- `read_write`: Can view and edit the document
- `comment`: Can view and add comments (Google Drive only)

**Returns:** `void`

**Note:** This replaces all existing permissions except the owner. To add a single user, get current permissions first.

---

### listDocuments(filters)

Searches and retrieves documents by metadata with pagination support.

```typescript
await docManager.listDocuments({
  metadata?: Record<string, any>, // Filter by metadata key-value pairs
  limit?: number,                 // Results per page (default: 10, max: 100)
  pageToken?: string              // Token from previous response for next page
});
```

**Returns:**
```typescript
{
  documents: Document[],          // Array of matching documents
  nextPageToken?: string | null,  // Token for next page (null if last page)
  limit: number                   // Page size used
}
```

**Example with pagination:**
```typescript
let pageToken: string | undefined;
do {
  const result = await docManager.listDocuments({
    metadata: { course: 'Math 101' },
    limit: 50,
    pageToken
  });
  
  // Process result.documents
  
  pageToken = result.nextPageToken;
} while (pageToken);
```

---

### getComments(documentId)

Retrieves all comments and replies from a document. **Google Drive only.**

```typescript
await docManager.getComments(documentId: string);
```

**Returns:** Array of `Comment` objects:
```typescript
{
  comment_id: string,
  author: string,           // Email of comment author
  content: string,          // Comment text
  created_at: string,       // ISO 8601 timestamp
  replies?: Array<{         // Optional replies to the comment
    reply_id: string,
    author: string,
    content: string,
    created_at: string
  }>
}
```

**Use case:** Essential for the teacher feedback workflow. Teachers can leave comments on student submissions, and students can reply to clarify or acknowledge feedback.



---

### getRevisions(documentId)

Retrieves the complete revision history of a document. **Google Drive only.**

```typescript
await docManager.getRevisions(documentId: string);
```

**Returns:** Array of `Revision` objects:
```typescript
{
  revision_id: string,
  modified_by: string,      // Email of user who made the revision
  modified_time: string,    // ISO 8601 timestamp
  size?: number            // File size in bytes (if available)
}
```

**Use case:** Critical for tracking student work progression and identifying which revision to use for final grading. Teachers can see when students made changes and tag specific revisions for evaluation.


## Security Notes

- Store service account keys securely (never commit to version control)
- Only grant necessary OAuth scopes
- Use dedicated service accounts, not personal admin accounts
- Follow principle of least privilege for permissions

## Development

```bash
pnpm install
pnpm run build
pnpm test
```