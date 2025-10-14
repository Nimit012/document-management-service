# Document Storage Library

A TypeScript library for managing educational documents across multiple storage providers (Google Drive, S3, etc.). Provides a unified interface for document operations, access control, and metadata management.

---

## 📁 Project Structure

```
document-storage-lib/
├── src/
│   ├── index.ts                      # Main entry point - exports public API
│   ├── DocumentManager.ts            # Main facade class
│   └── types/                        # TypeScript type definitions
│       ├── index.ts                  # Exports all types
│       ├── common.types.ts           # Core types (Document, AccessControl, etc.)
│       ├── provider.types.ts         # Provider configuration types
│       └── errors.types.ts           # Error type definitions
├── providers/                        # Storage provider implementations
│   ├── IStorageProvider.ts          # Provider interface contract
│   ├── google-drive/                # Google Drive implementation
│   │   ├── GoogleDriveProvider.ts   # Main provider class
│   │   ├── auth.ts                  # Authentication handling
│   │   ├── folders.ts               # Folder hierarchy management
│   │   ├── permissions.ts           # Access control mapping
│   │   └── metadata.ts              # Custom properties handling
│   └── s3/                          # S3 implementation (future)
│       └── S3Provider.ts
├── utils/                            # Utility functions
│   ├── errors.ts                    # Custom error classes
│   ├── validators.ts                # Input validation
│   └── logger.ts                    # Logging utility
├── examples/                         # Usage examples
├── tests/                           # Test files
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🗂️ File Descriptions

### Core Files

#### `src/index.ts`
**Purpose:** Main entry point that exports the public API

**Exports:**
- `DocumentManager` - Main class
- All TypeScript types
- Provider classes (GoogleDriveProvider, etc.)
- Error classes

**Usage:**
```typescript
import { DocumentManager, GoogleDriveProvider } from 'document-storage-lib';
```

---

#### `src/DocumentManager.ts`
**Purpose:** Main facade class that provides a unified interface for all document operations

**Responsibilities:**
- Accepts a provider instance in constructor
- Validates all inputs before delegating to provider
- Provides type-safe methods for document operations
- Handles error transformation

**Key Methods:**
- `createDocument()` - Create new document from source
- `getDocument()` - Retrieve document by ID
- `listDocuments()` - Search/filter documents
- `updateDocument()` - Update document name/metadata
- `deleteDocument()` - Delete document
- `setAccessControl()` - Set permissions
- `getAccessControl()` - Get current permissions
- `getComments()` - Get comments (provider-specific)
- `getRevisions()` - Get revision history (provider-specific)

**Internal Flow:**
```
User calls method → Validate input → Delegate to provider → Return result
```

---

### Type Definitions

#### `src/types/common.types.ts`
**Purpose:** Core type definitions used throughout the library

**Key Types:**
```typescript
// Main document structure
interface Document {
  document_id: string;
  provider: string;
  storage_reference: string;
  name: string;
  access_url: string;
  folder_path?: string;
  created_at: string;
  metadata?: Record<string, any>;
}

// Request to create document
interface CreateDocumentRequest {
  provider: 'google_drive' | 's3';
  source_reference: string;
  source_owner: string;
  name?: string;
  folder_path?: string;
  access_control?: AccessControl[];
  metadata?: Record<string, any>;
}

// Access control
interface AccessControl {
  user: string;
  access_level: 'read' | 'read_write' | 'comment';
}
```

---

#### `src/types/provider.types.ts`
**Purpose:** Provider-specific configuration types

**Key Types:**
```typescript
// Google Drive configuration

interface GoogleDriveConfig {
  serviceAccountKey: ServiceAccountKey;
  adminEmail: string;
}

// S3 configuration (future)
interface S3Config {
  region: string;
  bucket: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}
```

---

### Provider Layer

#### `providers/IStorageProvider.ts`
**Purpose:** Interface that all storage providers must implement

**Contract Methods:**
```typescript
interface IStorageProvider {
  // Document operations
  copyDocument(request: CreateDocumentRequest): Promise<Document>;
  getDocument(documentId: string): Promise<Document>;
  deleteDocument(documentId: string): Promise<void>;
  updateDocument(documentId: string, updates: {name?: string, metadata?: any}): Promise<Document>;
  
  // Metadata operations
  setMetadata(documentId: string, metadata: Record<string, any>): Promise<void>;
  getMetadata(documentId: string): Promise<Record<string, any>>;
  searchByMetadata(filters: Record<string, any>, limit?: number, offset?: number): Promise<SearchDocumentsResult>;
  
  // Access control
  setPermissions(documentId: string, accessControl: AccessControl[]): Promise<void>;
  getPermissions(documentId: string): Promise<AccessControl[]>;
  
  // Folder management
  createFolderPath(path: string): Promise<string>;  // No ownerEmail parameter
  
  // Optional
  getRevisions?(documentId: string): Promise<Revision[]>;
  getComments?(documentId: string): Promise<Comment[]>;
}
```

**Why this exists:** Allows adding new storage providers (S3, Azure, etc.) without changing the main API

---

#### `providers/google-drive/GoogleDriveProvider.ts`
**Purpose:** Google Drive implementation of IStorageProvider

**Responsibilities:**
- Initialize Google Drive API client
- Implement all IStorageProvider methods
- Orchestrate helper modules (auth, folders, permissions, metadata)
- Handle Google Drive specific operations

**Key Operations:**
- `copyDocument()` - Copies file in Google Drive, sets up ownership
- `setMetadata()` - Uses Google Drive custom file properties API
- `searchByMetadata()` - Queries Google Drive using properties
- `getRevisions()` - Uses Google Drive revisions API
- `getComments()` - Uses Google Drive comments API

---

#### `providers/google-drive/auth.ts`
**Purpose:** Handle Google Drive authentication

**What it does:**
- Creates JWT client from service account credentials
- Sets up OAuth scopes
- Handles domain-wide delegation if needed
- Provides authenticated client for API calls

**Key Class:**
```typescript
class GoogleAuth {
  private jwtClient: JWT;
  
  constructor(config: GoogleDriveConfig) {
    // Load service account credentials
    // Create JWT client
    // Set OAuth scopes
  }
  
  getClient(): JWT {
    return this.jwtClient;
  }
}
```

---



#### providers/google-drive/operations.ts
**Purpose:** Handle core document operations

**What it does:**
- Copy documents with two-step ownership transfer
- Get document metadata
- Update document names
- Delete documents permanently

**Key Methods:**
- `copyWithOwnershipTransfer()` - Impersonate source owner, copy, then transfer to admin
- `getDocument()` - Retrieve file metadata
- `updateName()` - Update file name
- `deleteDocument()` - Permanently delete file

#### `providers/google-drive/folders.ts`
**Purpose:** Manage folder hierarchy in Google Drive

**What it does:**
- Parses folder paths (e.g., "course/unit1/masters")
- Creates nested folder structure
- Finds existing folders or creates new ones
- Returns folder ID for document placement

**Key Class:**
```typescript
class FolderManager {
  async createPath(path: string): Promise<string> {
    // Split "course/unit1/masters" into parts
    // For each part, find or create folder
    // Return final folder ID
  }
  
  private async findOrCreateFolder(name: string, parentId: string | null): Promise<string> {
    // Search for existing folder
    // If not found, create new folder
    // Return folder ID
  }
}
```

**Example:** 
- Input: `"us_history2/unit1/masters"`
- Creates: `us_history2/` → `us_history2/unit1/` → `us_history2/unit1/masters/`
- Returns: Folder ID of `masters/`

---

#### `providers/google-drive/permissions.ts`
**Purpose:** Map generic access levels to Google Drive permissions

**What it does:**
- Converts access levels (read, read_write, comment) to Google Drive roles
- Sets permissions on files
- Transfers ownership when needed
- Clears old permissions before setting new ones

**Key Class:**
```typescript
class PermissionManager {
  async setPermissions(fileId: string, accessControl: AccessControl[]): Promise<void> {
    // Remove existing permissions (except owner)
    // Map access_level to Google Drive role
    // Create new permissions
  }
  
  async transferOwnership(fileId: string, ownerEmail: string): Promise<void> {
    // Transfer file ownership to specified user
  }
  
  private mapAccessLevelToRole(level: string): string {
    // read → reader
    // read_write → writer
    // comment → commenter
  }
}
```

**Mapping:**
- `read` → Google Drive `reader` role
- `read_write` → Google Drive `writer` role
- `comment` → Google Drive `commenter` role

---

#### `providers/google-drive/metadata.ts`
**Purpose:** Store and query metadata using Google Drive custom properties (NO DATABASE)

**What it does:**
- Stores metadata as Google Drive file properties
- Retrieves metadata from file properties
- Searches documents by metadata using Google Drive query API
- Enables filtering by activity_id, student_id, etc.

**Key Class:**
```typescript
class MetadataManager {
  async setMetadata(fileId: string, metadata: Record<string, any>): Promise<void> {
    // Store metadata in Google Drive custom properties
  }
  
  async getMetadata(fileId: string): Promise<Record<string, any>> {
    // Retrieve custom properties from file
  }
  
  async searchByMetadata(filters: Record<string, any>): Promise<Document[]> {
    // Build query: properties has { key='activity_id' and value='act_123' }
    // Search Google Drive
    // Return matching documents
  }
}
```

**Important:** No separate database! All metadata stored directly in Google Drive.

---

### Utilities

#### `utils/errors.ts`
**Purpose:** Custom error classes for better error handling

**Error Types:**
```typescript
class DocumentStorageError extends Error       // Base error
class ProviderError extends DocumentStorageError // Provider-specific errors
class ValidationError extends DocumentStorageError // Input validation errors
class NotFoundError extends DocumentStorageError  // Resource not found
class NotImplementedError extends DocumentStorageError // Feature not supported by provider
```

**Usage in code:**
```typescript
if (!request.source_reference) {
  throw new ValidationError('source_reference is required');
}
```

---

#### `utils/validators.ts`
**Purpose:** Validate inputs before sending to providers

**What it validates:**
- Required fields are present
- Field types are correct
- Access levels are valid (read, read_write, comment)
- Email formats are valid
- Metadata structure is correct

**Example:**
```typescript
function validateCreateRequest(request: CreateDocumentRequest): void {
  if (!request.provider) throw new ValidationError('provider required');
  if (!request.source_reference) throw new ValidationError('source_reference required');
  // ... more validations
}
```

---

#### `utils/logger.ts`
**Purpose:** Simple logging utility (optional)

**What it provides:**
- Structured logging interface
- Log levels (debug, info, warn, error)
- Can be replaced with external logger

---

## 🔄 Complete Workflow

### Scenario: Teacher creates master copy and student works on it

#### Step 1: Initialize Library
```typescript
import { DocumentManager, GoogleDriveProvider } from 'document-storage-lib';

// Create Google Drive provider
const googleDrive = new GoogleDriveProvider({
  serviceAccountKey: './service-account.json',
  lmsSystemAccount: 'lms@school.edu'
});

// Create document manager
const docManager = new DocumentManager(googleDrive);
```

**What happens:**
1. `GoogleDriveProvider` constructor creates `GoogleAuth` instance
2. Authenticates with Google using service account
3. Initializes Drive API client
4. Creates helper instances (FolderManager, PermissionManager, MetadataManager)

---

#### Step 2: Teacher Creates Master Copy
```typescript
const masterDoc = await docManager.createDocument({
  provider: 'google_drive',
  source_reference: '1a2b3c4d5e6f',
  source_owner: 'teacher@school.edu',
  name: 'Essay Assignment - Master',
  folder_path: 'us_history2/unit1/masters',
  metadata: {
    activity_id: 'act_123',
    document_type: 'master',
    course_id: 'us_history2'
  }
});
```

**Internal Flow:**

1. **DocumentManager.createDocument()**
   - Validates input using `validators.ts`
   - Calls `googleDrive.copyDocument()`

2. **GoogleDriveProvider.copyDocument()**
   - Calls `folderManager.createPath('us_history2/unit1/masters')`
   
3. **FolderManager.createPath()**
   - Splits path into ['us_history2', 'unit1', 'masters']
   - Creates each folder if doesn't exist
   - Returns final folder ID

4. **Back to GoogleDriveProvider**
   - Calls Google Drive API to copy file
   - Places copy in folder from step 3
   - Calls `operations.copyWithOwnershipTransfer()`
   - Calls `metadataManager.setMetadata()` to store metadata
   - Returns Document object

5. **DocumentManager returns result to caller**

**Result:** 
- New document created in Google Drive
- Owned by teacher@school.edu
- Stored in correct folder
- Metadata saved in Google Drive custom properties

---

#### Step 3: Student Creates Working Copy
```typescript
const studentDoc = await docManager.createDocument({
  provider: 'google_drive',
  source_reference: masterDoc.document_id,  // Copy from master
  source_owner: 'admin@school.edu'
  folder_path: 'us_history2/unit1/student_copies',
  access_control: [
    { user: 'student@school.edu', access_level: 'read_write' },
    { user: 'teacher@school.edu', access_level: 'read' }
  ],
  metadata: {
    activity_id: 'act_123',
    document_type: 'student_copy',
    student_id: 'student@school.edu',
    master_copy_id: masterDoc.document_id
  }
});
```

**Internal Flow:**

1. **DocumentManager validates and delegates**

2. **GoogleDriveProvider.copyDocument()**
   - Creates folder path for student copies
   - Copies master document
   - Stores metadata

3. **DocumentManager.createDocument() continues**
   - Sees `access_control` in request
   - Calls `googleDrive.setPermissions()`

4. **PermissionManager.setPermissions()**
   - Clears existing permissions
   - Maps `read_write` → `writer` role
   - Maps `read` → `reader` role
   - Grants permissions to student and teacher

**Result:**
- Student gets their own copy
- Student can edit (writer permission)
- Teacher can view (reader permission)
- Metadata links it to master and activity

---

#### Step 4: Student Submits Work
```typescript
await docManager.setAccessControl(studentDoc.storage_reference, [
  { user: 'student@school.edu', access_level: 'read' },
  { user: 'teacher@school.edu', access_level: 'comment' }
]);
```

**Internal Flow:**

1. **DocumentManager.setAccessControl()**
   - Validates access control array
   - Calls `googleDrive.setPermissions()`

2. **PermissionManager.setPermissions()**
   - Removes old permissions
   - Sets student to `reader` (read-only)
   - Sets teacher to `commenter` (can comment)

**Result:**
- Student can only view their work (no more editing)
- Teacher can view and add comments

---

#### Step 5: Teacher Requests Revision
```typescript
await docManager.setAccessControl(studentDoc.storage_reference, [
  { user: 'student@school.edu', access_level: 'read_write' },
  { user: 'teacher@school.edu', access_level: 'comment' }
]);
```

**Result:**
- Student can edit again (same document, no new copy)
- Teacher maintains comment access
- Google Drive automatically tracks version history

---

#### Step 6: LMS Queries Student Copies
```typescript
const studentCopies = await docManager.listDocuments({
  filters: {
    activity_id: 'act_123',
    document_type: 'student_copy'
  },
  limit: 50
});
```

**Internal Flow:**

1. **DocumentManager.listDocuments()**
   - Calls `googleDrive.searchByMetadata()`

2. **MetadataManager.searchByMetadata()**
   - Builds Google Drive query:
     ```
     properties has { key='activity_id' and value='act_123' } and
     properties has { key='document_type' and value='student_copy' }
     ```
   - Executes search
   - Returns matching documents with metadata

**Result:** List of all student copies for this activity

---

## 🎯 Key Design Concepts

### 1. No Database Architecture
**All data is stored in the provider:**
- **Google Drive:** Uses custom file properties API
- **S3 (future):** Uses object tags

**Ownership Model:**
- All documents are owned by the admin account (specified in config)
- Service account uses domain-wide delegation to impersonate users
- Only `copyDocument` needs `source_owner` to access source documents
- All other operations performed as admin

**Benefits:**
- Simpler deployment (no DB to manage)
- Single source of truth
- Centralized control
- Provider-native features (search, versioning)

### 2. Provider Pattern
**Easy to add new storage types:**
```typescript
// Add S3 support
class S3Provider implements IStorageProvider {
  // Implement all required methods
}

// Use it
const s3 = new S3Provider(config);
const manager = new DocumentManager(s3);
```

### 3. Separation of Concerns
- **DocumentManager:** Validation, orchestration
- **Provider:** Storage operations
- **Helper modules:** Specialized tasks (auth, folders, permissions)

### 4. Type Safety
- Full TypeScript support
- Compile-time error checking
- IntelliSense support in IDEs

---

## 📦 Installation & Usage

### Install
```bash
npm install document-storage-lib
```

### Basic Usage
```typescript
import { DocumentManager, GoogleDriveProvider } from 'document-storage-lib';

// Setup
import serviceAccountKey from './service-account-key.json';

const provider = new GoogleDriveProvider({
  serviceAccountKey: serviceAccountKey,  // Object, not string
  adminEmail: 'admin@school.edu'  // Changed from lmsSystemAccount
});

const manager = new DocumentManager(provider);

// Create document
const doc = await manager.createDocument({
  provider: 'google_drive',
  source_reference: 'abc123',
  source_owner: 'teacher@school.edu',  // ✅ Required field
  name: 'My Document',
  metadata: { activity_id: 'act_1' }
});

const manager = new DocumentManager(provider);

// Create document
const doc = await manager.createDocument({
  provider: 'google_drive',
  source_reference: 'abc123',
  name: 'My Document',
  metadata: { activity_id: 'act_1' }
});

// Update permissions
await manager.setAccessControl(doc.storage_reference, [
  { user: 'user@school.edu', access_level: 'read_write' }
]);
```

---

## 🔌 Adding New Providers

To add a new storage provider (e.g., S3):

1. Create `providers/s3/S3Provider.ts`
2. Implement `IStorageProvider` interface
3. Handle provider-specific logic
4. Export from `providers/index.ts`

```typescript
class S3Provider implements IStorageProvider {
  async copyDocument(request: CreateDocumentRequest): Promise<Document> {
    // Copy object in S3
    // Store metadata as object tags
    // Generate pre-signed URL
  }
  
  // ... implement other methods
}
```

The `DocumentManager` will work with it automatically!