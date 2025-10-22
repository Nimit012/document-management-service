# Document Management Service 📄

A comprehensive TypeScript library for managing documents across multiple cloud storage providers with advanced features like ownership transfer, permission management, metadata operations, and provider-specific integrations.

## 🎯 Project Overview

This service provides a unified interface for document management operations across multiple cloud storage providers, designed for educational platforms and enterprise environments. It handles complex workflows like copying documents from source users, transferring ownership to administrators, creating organized folder structures, and managing granular permissions.

**Currently Supported Providers:**
- ✅ **Google Drive** - Full implementation with domain-wide delegation
- 🚧 **Amazon S3** - Planned for future releases

**Provider-Agnostic Features:**
- Unified API across all providers
- Consistent error handling and types
- Extensible architecture for adding new providers

### Key Capabilities

- **Document Operations**: Copy, move, create, update, and delete documents across providers
- **Ownership Transfer**: Seamlessly transfer document ownership (Google Drive) or access control (S3)
- **Permission Management**: Set granular access controls (read, write, comment) for individual users
- **Metadata Operations**: Add custom properties and search documents by metadata
- **Folder Management**: Create nested folder structures and organize documents
- **Provider-Specific Features**: 
  - Google Drive: Domain-wide delegation, comments, revisions
  - S3: Bucket management, presigned URLs (planned)
- **Pagination Support**: Token-based pagination for efficient large-scale operations
- **Extensible Architecture**: Easy to add new storage providers

## 🏗️ Architecture

The service follows a modular architecture with clear separation of concerns:

```
DocumentManager (Main Facade)
    ↓
Provider Selection
    ↓
┌─────────────────┬─────────────────┐
│ GoogleDriveProvider │ S3Provider (Future) │
│                 │                 │
│ • Orchestrator  │ • Orchestrator  │
│ • Auth Helper   │ • Auth Helper   │
│ • Operations    │ • Operations    │
│ • Permissions   │ • Permissions   │
│ • Metadata      │ • Metadata      │
└─────────────────┴─────────────────┘
    ↓
Provider-Specific APIs
    ↓
┌─────────────────┬─────────────────┐
│ Google Drive API │ AWS S3 API      │
└─────────────────┴─────────────────┘
```

### Google Drive Implementation Details

```
GoogleDriveProvider (Orchestrator)
    ↓
┌─────────────────┬─────────────────┬─────────────────┐
│ DocumentOperations │ DocumentPermissions │ DocumentMetadata │
│                 │                 │                 │
│ • Copy/Move     │ • Ownership     │ • Set/Get       │
│ • Folder Mgmt   │ • Permissions  │ • Search        │
│ • CRUD Ops      │ • Access Ctrl  │ • Pagination    │
└─────────────────┴─────────────────┴─────────────────┘
    ↓
GoogleAuthHelper (Authentication)
    ↓
Google Drive API v3
```

### Component Interactions

1. **DocumentManager** provides a unified interface and selects the appropriate provider
2. **Provider Classes** (GoogleDriveProvider, S3Provider) act as orchestrators for their respective services
3. **Operation Classes** handle provider-specific implementations:
   - DocumentOperations: File-level operations (copy, move, folder creation)
   - DocumentPermissions: Ownership transfers and access control
   - DocumentMetadata: Custom properties and search functionality
4. **Auth Helpers** provide provider-specific authentication

### Provider-Specific Features

#### Google Drive
- **Domain-wide Delegation**: Service account can impersonate any user in your Google Workspace domain
- **Ownership Transfer**: Seamlessly transfer document ownership between users
- **Comments & Revisions**: Access to document comments and revision history
- **Advanced Permissions**: Granular access control (read, write, comment)

#### Amazon S3 (Planned)
- **Bucket Management**: Create and manage S3 buckets
- **Presigned URLs**: Generate secure, time-limited access URLs
- **IAM Integration**: Use AWS IAM for permission management
- **Metadata Storage**: Store custom metadata as S3 object tags

## 📋 Prerequisites

### Provider-Specific Requirements

#### Google Drive Setup

- **Google Workspace Admin Account**: Required to configure domain-wide delegation
- **Service Account**: Must be created in Google Cloud Console with domain-wide delegation enabled
- **OAuth Scopes**: The service account needs the following scope:
  - `https://www.googleapis.com/auth/drive` (Full Drive access)

#### Amazon S3 Setup (Future)

- **AWS Account**: Active AWS account with S3 access
- **IAM User/Role**: With appropriate S3 permissions
- **Access Credentials**: AWS Access Key ID and Secret Access Key
- **Bucket**: S3 bucket for document storage

### Setup Steps

#### Google Drive Setup

1. **Create Service Account**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable Google Drive API
   - Create a service account
   - Download the service account key (JSON file)

2. **Enable Domain-wide Delegation**:
   - In Google Cloud Console, go to IAM & Admin → Service Accounts
   - Click on your service account
   - Go to "Advanced settings" → "Domain-wide delegation"
   - Enable domain-wide delegation
   - Note the Client ID

3. **Configure in Google Workspace Admin**:
   - Go to [Google Admin Console](https://admin.google.com/)
   - Navigate to Security → API Controls
   - Click "Domain-wide delegation"
   - Add your service account's Client ID
   - Add the scope: `https://www.googleapis.com/auth/drive`

#### Amazon S3 Setup (Future)

1. **Create S3 Bucket**:
   - Go to [AWS S3 Console](https://console.aws.amazon.com/s3/)
   - Create a new bucket
   - Configure bucket permissions and policies

2. **Create IAM User/Role**:
   - Go to [AWS IAM Console](https://console.aws.amazon.com/iam/)
   - Create user or role with S3 permissions
   - Generate access credentials

3. **Configure Bucket Policies**:
   - Set up appropriate bucket policies for your use case
   - Configure CORS if needed for web access

## 📦 Installation

### From GitHub Repository

```bash
# Using npm
npm install git+https://github.com/yourusername/doc-management-service.git

# Using yarn
yarn add git+https://github.com/yourusername/doc-management-service.git

# Using pnpm
pnpm add git+https://github.com/yourusername/doc-management-service.git
```

### From NPM (when published)

```bash
# Using npm
npm install document-management-service

# Using yarn
yarn add document-management-service

# Using pnpm
pnpm add document-management-service
```

### Dependencies

The service requires the following peer dependencies:

**Google Drive Provider:**
- `googleapis` (^162.0.0)
- `google-auth-library` (^10.4.0)

**Amazon S3 Provider (Future):**
- `@aws-sdk/client-s3` (^3.0.0)
- `@aws-sdk/s3-request-presigner` (^3.0.0)

## 🚀 Quick Start

### Basic Setup and Usage

Here's how to get started with the Document Management Service in your application:

```typescript
import { 
  DocumentManager, 
  ProviderType, 
  GoogleDriveConfig,
  CreateDocumentRequest,
  AccessControl 
} from 'document-management-service';

// 1. Configure Google Drive (see Configuration section for details)
const config: GoogleDriveConfig = {
  serviceAccountKey: {
    type: "service_account",
    project_id: "your-project-id",
    private_key_id: "your-private-key-id",
    private_key: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    client_email: "your-service-account@your-project.iam.gserviceaccount.com",
    client_id: "your-client-id",
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-project.iam.gserviceaccount.com"
  },
  adminEmail: "admin@yourdomain.com"
};

// 2. Initialize the DocumentManager
const docManager = new DocumentManager({
  provider: ProviderType.GOOGLE_DRIVE,
  config: config
});

// 3. Use the service
async function example() {
  try {
    // Create a document from a source
    const document = await docManager.createDocument({
      source_reference: "1ABC123DEF456GHI789JKL", // Google Drive file ID
      source_owner: "teacher@example.com", // Email of source owner
      name: "Student Assignment Copy",
      folder_path: "/assignments/unit1",
      metadata: {
        project: "History Project",
        grade_level: 9
      },
      access_control: [
        {
          user: "student@example.com",
          access_level: "read_write"
        }
      ]
    });

    console.log('Document created:', document.document_id);
    console.log('Access URL:', document.access_url);

    // Get the document
    const retrievedDoc = await docManager.getDocument(document.document_id);
    console.log('Retrieved document:', retrievedDoc.name);

    // Search for documents
    const results = await docManager.listDocuments(
      { project: "History Project" },
      10
    );
    console.log(`Found ${results.documents.length} documents`);

  } catch (error) {
    console.error('Error:', error);
  }
}
```

### Environment Variables Setup

For security, store your credentials in environment variables:

```bash
# .env file
GOOGLE_DRIVE_PROJECT_ID=your-project-id
GOOGLE_DRIVE_PRIVATE_KEY_ID=your-private-key-id
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_CLIENT_EMAIL=your-service-account@your-project.iam.gserviceaccount.com
GOOGLE_DRIVE_CLIENT_ID=your-client-id
GOOGLE_DRIVE_ADMIN_EMAIL=admin@yourdomain.com
```

```typescript
// Using environment variables
const config: GoogleDriveConfig = {
  serviceAccountKey: {
    type: "service_account",
    project_id: process.env.GOOGLE_DRIVE_PROJECT_ID!,
    private_key_id: process.env.GOOGLE_DRIVE_PRIVATE_KEY_ID!,
    private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY!,
    client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL!,
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
    auth_uri: "https://accounts.google.com/o/oauth2/auth",
    token_uri: "https://oauth2.googleapis.com/token",
    auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
    client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GOOGLE_DRIVE_CLIENT_EMAIL!)}`
  },
  adminEmail: process.env.GOOGLE_DRIVE_ADMIN_EMAIL!
};
```

### Complete Usage Examples

#### Document Operations

```typescript
// Create a document
const createRequest: CreateDocumentRequest = {
  source_reference: "1ABC123DEF456GHI789JKL",
  source_owner: "user@example.com",
  name: "My New Document",
  folder_path: "/Documents/Projects",
  metadata: {
    project: "My Project",
    category: "Important",
    tags: ["urgent", "review"]
  },
  access_control: [
    {
      user: "collaborator@example.com",
      access_level: "read_write"
    },
    {
      user: "reviewer@example.com", 
      access_level: "comment"
    }
  ]
};

const document = await docManager.createDocument(createRequest);

// Get a document
const doc = await docManager.getDocument(document.document_id);

// Update a document
const updatedDoc = await docManager.updateDocument(document.document_id, {
  name: "Updated Document Name",
  metadata: {
    project: "Updated Project",
    status: "completed"
  }
});

// Delete a document
await docManager.deleteDocument(document.document_id);
```

#### Permission Management

```typescript
// Set document permissions
const permissions: AccessControl[] = [
  {
    user: "student1@example.com",
    access_level: "read_write"
  },
  {
    user: "student2@example.com",
    access_level: "read"
  },
  {
    user: "teacher@example.com",
    access_level: "comment"
  }
];

await docManager.setAccessControl(document.document_id, permissions);
```

#### Search and Pagination

```typescript
// Search documents with pagination
const result = await docManager.listDocuments(
  { project: "My Project" }, // metadata filters
  10, // limit
  undefined // pageToken for pagination
);

console.log('Documents found:', result.documents);
console.log('Next page token:', result.nextPageToken);

// Get next page
if (result.nextPageToken) {
  const nextPage = await docManager.listDocuments(
    { project: "My Project" },
    10,
    result.nextPageToken
  );
}
```

#### Google Drive Specific Features

```typescript
// Get document comments (Google Drive only)
const comments = await docManager.getComments(document.document_id);
comments.forEach(comment => {
  console.log(`${comment.author}: ${comment.content}`);
  if (comment.replies) {
    comment.replies.forEach(reply => {
      console.log(`  Reply from ${reply.author}: ${reply.content}`);
    });
  }
});

// Get document revision history (Google Drive only)
const revisions = await docManager.getRevisions(document.document_id);
revisions.forEach(revision => {
  console.log(`Revision ${revision.revision_id} by ${revision.modified_by}`);
  console.log(`Modified: ${revision.modified_time}`);
});
```

#### Error Handling

```typescript
import { ValidationError } from 'document-management-service';

try {
  const document = await docManager.createDocument(request);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation error:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### TypeScript Support

The library provides full TypeScript support with:
- Complete type definitions
- IntelliSense support for all methods and interfaces
- Type safety for all operations
- Comprehensive error types

### Available Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `createDocument` | Create a document from a source | `CreateDocumentRequest` | `Promise<Document>` |
| `getDocument` | Retrieve a document by ID | `documentId: string` | `Promise<Document>` |
| `updateDocument` | Update document name/metadata | `documentId: string`, `updates: object` | `Promise<Document>` |
| `deleteDocument` | Delete a document | `documentId: string` | `Promise<void>` |
| `setAccessControl` | Set document permissions | `documentId: string`, `accessControl: AccessControl[]` | `Promise<void>` |
| `listDocuments` | Search documents by metadata | `filters: object`, `limit: number`, `pageToken?: string` | `Promise<SearchDocumentsResult>` |
| `getComments` | Get document comments | `documentId: string` | `Promise<Comment[]>` |
| `getRevisions` | Get document revision history | `documentId: string` | `Promise<Revision[]>` |

### Build Configuration

The library is built with **tsup** and provides:

- **Dual format support**: Both CommonJS (`dist/index.js`) and ESM (`dist/index.mjs`)
- **TypeScript definitions**: Complete type definitions (`dist/index.d.ts`)
- **Source maps**: For debugging (`dist/index.js.map`, `dist/index.mjs.map`)
- **Tree shaking**: Optimized for bundlers
- **External dependencies**: Google APIs are marked as external

This means the library works seamlessly in:
- **Node.js** applications
- **Modern bundlers** (Vite, Webpack, Rollup)
- **TypeScript** projects with full IntelliSense
- **Browser** environments (when bundled)

### Package.json Configuration

The library exports are configured for maximum compatibility:

```json
{
  "main": "dist/index.js",
  "module": "dist/index.mjs", 
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  }
}
```

## ⚙️ Configuration

### Provider Configuration

#### Google Drive Configuration

```typescript
import { DocumentManager, ProviderType, GoogleDriveConfig } from 'document-management-service';

// Load your service account key
const serviceAccountKey = {
  type: "service_account",
  project_id: "your-project-id",
  private_key_id: "your-private-key-id",
  private_key: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  client_email: "your-service-account@your-project.iam.gserviceaccount.com",
  client_id: "your-client-id",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs/your-service-account%40your-project.iam.gserviceaccount.com"
};

// Configure the service
const config: GoogleDriveConfig = {
  serviceAccountKey: serviceAccountKey,
  adminEmail: 'admin@yourdomain.com' // The admin who will own all documents
};

// Initialize DocumentManager
const documentManager = new DocumentManager({
  provider: ProviderType.GOOGLE_DRIVE,
  config: config
});
```

#### Amazon S3 Configuration (Future)

```typescript
import { DocumentManager, ProviderType, S3Config } from 'document-management-service';

// Configure S3 provider
const s3Config: S3Config = {
  region: 'us-east-1',
  bucket: 'your-document-bucket',
  accessKeyId: 'your-access-key-id',     // Optional if using IAM roles
  secretAccessKey: 'your-secret-key'     // Optional if using IAM roles
};

// Initialize DocumentManager with S3
const documentManager = new DocumentManager({
  provider: ProviderType.S3,
  config: s3Config
});
```

### Configuration Types

#### Google Drive Service Account Key Structure

The service account key must include all required fields:

```typescript
interface ServiceAccountKey {
  type: string;                    // "service_account"
  project_id: string;             // Your Google Cloud project ID
  private_key_id: string;         // Private key identifier
  private_key: string;            // RSA private key (PEM format)
  client_email: string;           // Service account email
  client_id: string;              // OAuth client ID
  auth_uri: string;              // OAuth authorization URI
  token_uri: string;              // OAuth token URI
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}
```

#### Amazon S3 Configuration Structure

```typescript
interface S3Config {
  region: string;                 // AWS region (e.g., 'us-east-1')
  bucket: string;                 // S3 bucket name
  accessKeyId?: string;           // AWS access key (optional with IAM roles)
  secretAccessKey?: string;       // AWS secret key (optional with IAM roles)
}
```

## 🚀 Usage Examples

### Provider Selection

```typescript
import { DocumentManager, ProviderType } from 'document-management-service';

// Choose your provider
const provider = ProviderType.GOOGLE_DRIVE; // or ProviderType.S3 (when available)

const documentManager = new DocumentManager({
  provider: provider,
  config: provider === ProviderType.GOOGLE_DRIVE ? googleDriveConfig : s3Config
});
```

### Google Drive Examples

#### Copy Document with Ownership Transfer

```typescript
import { DocumentManager, ProviderType, GoogleDriveConfig } from 'document-management-service';

const documentManager = new DocumentManager({
  provider: ProviderType.GOOGLE_DRIVE,
  config: config
});

// Copy a document from a teacher's Drive and transfer ownership to admin
const document = await documentManager.createDocument({
  source_reference: '1ABC123def456GHI789jkl', // Google Drive file ID
  source_owner: 'teacher@yourdomain.com',     // Teacher's email
  name: 'Student Assignment Copy',             // New document name
  folder_path: 'assignments/unit1/student_copies', // Optional folder structure
  access_control: [                            // Optional permissions
    {
      user: 'student@yourdomain.com',
      access_level: 'read_write'
    },
    {
      user: 'teacher@yourdomain.com',
      access_level: 'comment'
    }
  ],
  metadata: {                                  // Optional custom metadata
    activity_id: 'act_123',
    document_type: 'student_copy',
    grade_level: 9,
    subject: 'history'
  }
});

console.log('Document created:', document.document_id);
console.log('Access URL:', document.access_url);
```

### Create Folder Structure

```typescript
// The service automatically creates nested folder structures
const document = await documentManager.createDocument({
  source_reference: '1ABC123def456GHI789jkl',
  source_owner: 'teacher@yourdomain.com',
  name: 'Lesson Plan',
  folder_path: 'curriculum/us_history/unit1/lesson_plans' // Creates all folders
});

// Folders created:
// - curriculum/
// - curriculum/us_history/
// - curriculum/us_history/unit1/
// - curriculum/us_history/unit1/lesson_plans/
```

### Set Document Permissions

```typescript
// Set permissions on an existing document
await documentManager.setAccessControl('1ABC123def456GHI789jkl', [
  {
    user: 'student1@yourdomain.com',
    access_level: 'read_write'
  },
  {
    user: 'student2@yourdomain.com',
    access_level: 'read'
  },
  {
    user: 'teacher@yourdomain.com',
    access_level: 'comment'
  }
]);
```

### Search Documents by Metadata

```typescript
// Search for documents with specific metadata
const results = await documentManager.listDocuments(
  {
    activity_id: 'act_123',
    document_type: 'student_copy'
  },
  20, // limit
  undefined // pageToken for pagination
);

console.log(`Found ${results.documents.length} documents`);
results.documents.forEach(doc => {
  console.log(`${doc.name}: ${doc.access_url}`);
});

// Handle pagination
if (results.nextPageToken) {
  const nextPage = await documentManager.listDocuments(
    { activity_id: 'act_123' },
    20,
    results.nextPageToken
  );
}
```

### Get Document Metadata

```typescript
// Retrieve a document
const document = await documentManager.getDocument('1ABC123def456GHI789jkl');

// Update document metadata
await documentManager.updateDocument('1ABC123def456GHI789jkl', {
  name: 'Updated Document Name',
  metadata: {
    status: 'completed',
    grade: 95,
    feedback: 'Excellent work!'
  }
});
```

#### Access Comments and Revisions (Google Drive Only)

```typescript
// Get document comments (Google Drive only)
const comments = await documentManager.getComments('1ABC123def456GHI789jkl');
comments.forEach(comment => {
  console.log(`${comment.author}: ${comment.content}`);
  if (comment.replies) {
    comment.replies.forEach(reply => {
      console.log(`  Reply from ${reply.author}: ${reply.content}`);
    });
  }
});

// Get document revision history (Google Drive only)
const revisions = await documentManager.getRevisions('1ABC123def456GHI789jkl');
revisions.forEach(revision => {
  console.log(`Revision ${revision.revision_id} by ${revision.modified_by}`);
  console.log(`Modified: ${revision.modified_time}`);
});
```

### Amazon S3 Examples (Future)

#### Upload Document to S3

```typescript
// Upload a document to S3 (when S3 provider is implemented)
const document = await documentManager.createDocument({
  source_reference: 'local-file-path-or-url',
  source_owner: 'system', // S3 doesn't have user ownership like Google Drive
  name: 'Document.pdf',
  folder_path: 'documents/2024/january', // S3 object key prefix
  metadata: {
    document_type: 'contract',
    department: 'legal',
    confidential: true
  }
});
```

#### Generate Presigned URLs (Future)

```typescript
// Generate presigned URL for secure access (when implemented)
const presignedUrl = await documentManager.generatePresignedUrl(
  'documents/contract.pdf',
  { expiresIn: 3600 } // 1 hour
);
console.log('Secure access URL:', presignedUrl);
```

## 📚 API Reference

### DocumentManager

The main facade class that provides a unified interface for all document operations.

#### Constructor

```typescript
constructor(options: DocumentManagerConfig)
```

#### Methods

| Method | Description | Parameters | Returns |
|--------|-------------|------------|---------|
| `createDocument` | Copy document from source with ownership transfer | `CreateDocumentRequest` | `Promise<Document>` |
| `getDocument` | Retrieve document by ID | `documentId: string` | `Promise<Document>` |
| `updateDocument` | Update document name and/or metadata | `documentId: string`, `updates: object` | `Promise<Document>` |
| `deleteDocument` | Permanently delete document | `documentId: string` | `Promise<void>` |
| `setAccessControl` | Set document permissions | `documentId: string`, `accessControl: AccessControl[]` | `Promise<void>` |
| `listDocuments` | Search documents by metadata | `filters: object`, `limit: number`, `pageToken?: string` | `Promise<SearchDocumentsResult>` |
| `getComments` | Get document comments | `documentId: string` | `Promise<Comment[]>` |
| `getRevisions` | Get document revision history | `documentId: string` | `Promise<Revision[]>` |

### Types

#### Document

```typescript
interface Document {
  document_id: string;
  storage_reference: string;
  name: string;
  access_url: string;
  folder_path?: string;
  created_at: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}
```

#### CreateDocumentRequest

```typescript
interface CreateDocumentRequest {
  source_reference: string;        // Google Drive file ID
  source_owner: string;           // Email of source document owner
  name?: string;                  // New document name
  folder_path?: string;          // Target folder path
  access_control?: AccessControl[]; // Permissions to set
  metadata?: Record<string, unknown>; // Custom metadata
}
```

#### AccessControl

```typescript
interface AccessControl {
  user: string;                  // User email address
  access_level: 'read' | 'read_write' | 'comment';
}
```

#### SearchDocumentsResult

```typescript
interface SearchDocumentsResult {
  documents: Document[];
  nextPageToken?: string | null;
  limit: number;
}
```

## ⚠️ Error Handling

The service uses a hierarchical error system for comprehensive error handling:

### Error Types

```typescript
// Base error class
class DocumentStorageError extends Error

// Provider-specific errors (API failures, network issues)
class ProviderError extends DocumentStorageError

// Input validation errors
class ValidationError extends DocumentStorageError

// Resource not found errors
class NotFoundError extends DocumentStorageError

// Permission/authorization errors
class PermissionError extends DocumentStorageError

// Feature not implemented by provider
class NotImplementedError extends DocumentStorageError
```

### Error Handling Example

```typescript
try {
  const document = await documentManager.createDocument({
    source_reference: 'invalid-id',
    source_owner: 'teacher@yourdomain.com'
  });
} catch (error) {
  if (error instanceof NotFoundError) {
    console.error('Document not found:', error.message);
  } else if (error instanceof ProviderError) {
    console.error('Google Drive API error:', error.message);
    console.error('Original error:', error.originalError);
  } else if (error instanceof ValidationError) {
    console.error('Invalid input:', error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Common Error Scenarios

#### Google Drive Errors
- **404 Errors**: Document not found or user doesn't have access
- **403 Errors**: Insufficient permissions or domain-wide delegation not configured
- **400 Errors**: Invalid request parameters or malformed service account key
- **Rate Limiting**: Google API quota exceeded (handled automatically with retries)

#### Amazon S3 Errors (Future)
- **403 Errors**: Insufficient S3 permissions or bucket access denied
- **404 Errors**: Object not found in S3 bucket
- **400 Errors**: Invalid bucket name or region configuration
- **Rate Limiting**: AWS API throttling (handled automatically with retries)

## 💡 Best Practices

### When to Use Which Operations

- **`createDocument`**: Use for copying documents from users with full workflow (ownership transfer, permissions, metadata)
- **`getDocument`**: Use for retrieving document information
- **`updateDocument`**: Use for modifying document names or adding metadata
- **`setAccessControl`**: Use for changing permissions on existing documents
- **`listDocuments`**: Use for searching and filtering documents by metadata

### Pagination Guidance

- Use `limit` parameter to control page size (max 100)
- Always check for `nextPageToken` to handle pagination
- For large datasets, implement proper pagination loops
- Consider caching results for frequently accessed data

### Security Considerations

#### Google Drive
- **Service Account Key**: Store securely, never commit to version control
- **Domain-wide Delegation**: Only grant necessary scopes
- **Admin Email**: Use a dedicated service account, not personal admin account
- **Permissions**: Follow principle of least privilege
- **Audit Logging**: Monitor document operations for compliance

#### Amazon S3 (Future)
- **Access Keys**: Store AWS credentials securely, use IAM roles when possible
- **Bucket Policies**: Implement least-privilege bucket access policies
- **Encryption**: Enable S3 server-side encryption for sensitive documents
- **CORS**: Configure CORS policies appropriately for web access
- **Audit Logging**: Enable CloudTrail for S3 operations monitoring

### Performance Tips

#### Google Drive
- **Client Caching**: The service caches Drive API clients per user
- **Batch Operations**: Consider batching multiple operations
- **Metadata Search**: Use specific filters to reduce search scope
- **Folder Structure**: Plan folder hierarchy to avoid deep nesting

#### Amazon S3 (Future)
- **Multipart Uploads**: Use multipart uploads for large files
- **CloudFront**: Use CloudFront CDN for faster document access
- **Object Lifecycle**: Configure lifecycle policies for cost optimization
- **Parallel Operations**: Leverage S3's parallel processing capabilities

## 🔧 Development

### Project Structure

```
src/
├── DocumentManager.ts          # Main facade class
├── index.ts                   # Public API exports
└── types/                     # Type definitions
    ├── common.types.ts        # Core types
    ├── provider.types.ts      # Provider configurations
    └── errors.types.ts        # Error classes

providers/
├── IStorageProvider.ts        # Provider interface
├── google-drive/              # Google Drive implementation
│   ├── GoogleDriveProvider.ts # Main orchestrator
│   ├── auth.ts               # Authentication helper
│   ├── operations.ts         # Document operations
│   ├── permissions.ts        # Permission management
│   └── metadata.ts           # Metadata operations
└── s3/                        # Amazon S3 implementation (future)
    ├── S3Provider.ts          # Main orchestrator
    ├── auth.ts               # AWS authentication
    ├── operations.ts         # S3 operations
    ├── permissions.ts        # IAM permissions
    └── metadata.ts           # S3 metadata/tags
```

### Extending with New Operations

To add new operations:

1. **Add method to interface** (`IStorageProvider.ts`):
```typescript
interface IStorageProvider {
  // ... existing methods
  newOperation?(param: string): Promise<Result>;
}
```

2. **Implement in GoogleDriveProvider**:
```typescript
async newOperation(param: string): Promise<Result> {
  // Implementation using existing components
  return await this.operations.newOperation(param);
}
```

3. **Add to DocumentManager**:
```typescript
async newOperation(param: string): Promise<Result> {
  return await this.provider.newOperation(param);
}
```

4. **Update types** if needed in `types/` directory

### Building and Testing

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build

# Run tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Type checking
pnpm run type-check

# Development mode with watch
pnpm run dev
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

---

## 📄 License

ISC License - see LICENSE file for details.

## 👥 Author

**Nimit Jain** - *Initial work*

---

*This service is designed for educational platforms and enterprise environments requiring sophisticated document management capabilities across multiple cloud storage providers.*
