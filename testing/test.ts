import { DocumentManager } from '../src/DocumentManager';
import { ProviderType } from '../src/types/provider.types';
// Replace with your actual Google Drive service account credentials
const config: any = {
  serviceAccountKey: {

  },
  adminEmail: 'sarah.admin@greydls.com'
};

async function testCreateDocument() {
  // Initialize DocumentManager
  const docManager = new DocumentManager({
    provider: ProviderType.GOOGLE_DRIVE,
    config: config
  });

  // Call createDocument function
  const result = await docManager.createDocument({
    source_reference: '1c8UGCad8G7LMFahr_oYfONiyGk0qIty4RIsu9Q9EYzs', // Replace with actual Google Drive file ID
    source_owner: 'maria.teacher@greydls.com', // Email of document owner
    name: 'Master Copy of assignment 2',
    folder_path: 'test-folder', // Optional
    metadata: {
      createdBy: 'integration-test',
      type: 'assignment',
      runTimestamp: Date.now()
    }
  });

  console.log('Document created:', result);
}

async function testGetDocument() {
  // Initialize DocumentManager
  const docManager = new DocumentManager({
    provider: ProviderType.GOOGLE_DRIVE,
    config: config
  });

  try {
    // Test getting a document by ID
    const documentId = '17rgRPjXlZ7Juj9GTezjI0iUsFsET00eL5i0eVyCMpqg'; // Replace with actual Google Drive file ID
    const result = await docManager.getDocument(documentId);

    console.log('Document retrieved:', result);
  } catch (error) {
    console.error('Error retrieving document:', error);
  }
}

async function testUpdateDocument() {
  // Initialize DocumentManager
  const docManager = new DocumentManager({
    provider: ProviderType.GOOGLE_DRIVE,
    config: config
  });

  try {
    // Test updating a document by ID
    const documentId = '17rgRPjXlZ7Juj9GTezjI0iUsFsET00eL5i0eVyCMpqg'; // Replace with actual Google Drive file ID

    // Test updating both name and metadata
    console.log('Testing combined update...');
    const combinedUpdateResult = await docManager.updateDocument(documentId, {
      name: 'Final Updated Document Name',
      metadata: {
        finalUpdate: true,
        updateTimestamp: Date.now(),
        testStatus: 'completed'
      }
    });
    console.log('Document fully updated:', combinedUpdateResult);
  } catch (error) {
    console.error('Error updating document:', error);
  }
}

async function testDeleteDocument() {
  // Initialize DocumentManager
  const docManager = new DocumentManager({
    provider: ProviderType.GOOGLE_DRIVE,
    config: config
  });

  try {
    console.log('Creating a test document for deletion...');

    const documentIdToDelete = '1codXWTIwhGvOLkHudyG75EB5KQlo_AURvYmdYjEMgkE';

    // Delete the document
    console.log('Deleting document...');
    await docManager.deleteDocument(documentIdToDelete);
    console.log('✅ Document successfully deleted:', documentIdToDelete);
  } catch (error) {
    console.error('Error in delete document test:', error);
  }
}

async function testListDocuments() {
  // Initialize DocumentManager
  const docManager = new DocumentManager({
    provider: ProviderType.GOOGLE_DRIVE,
    config: config
  });

  try {
    console.log('Testing listDocuments with various filters...');

    // Test 1: List all documents (no filters)
    // console.log('\n1. Listing all documents (no filters):');
    // const allDocs = await docManager.listDocuments({}, 10, 0);
    // console.log(`Found ${allDocs.documents.length} documents (total: ${allDocs.total})`);
    // allDocs.documents.forEach((doc, index) => {
    //   console.log(`  ${index + 1}. ${doc.name} (ID: ${doc.document_id})`);
    // });

    // Test 2: Search by specific metadata (if you have documents with these properties)
    console.log('\n2. Searching by metadata filters:');
    const filteredDocs = await docManager.listDocuments(
      {
        type: 'assignment'
      },
      5,
    );
    console.log(`Found ${filteredDocs.documents.length} documents matching filters`);
    filteredDocs.documents.forEach((doc, index) => {
      console.log(`  ${index + 1}. ${doc.name} (ID: ${doc.document_id})`);
      if (doc.metadata) {
        console.log(`     Metadata:`, doc.metadata);
      }
    });

    // // Test 3: Test pagination
    // console.log('\n3. Testing pagination (limit: 3, offset: 0):');
    // const paginatedDocs = await docManager.listDocuments({}, 3, 0);
    // console.log(`Found ${paginatedDocs.documents.length} documents (limit: 3, offset: 0)`);
    // paginatedDocs.documents.forEach((doc, index) => {
    //   console.log(`  ${index + 1}. ${doc.name}`);
    // });

    console.log('\n✅ listDocuments test completed successfully');
  } catch (error) {
    console.error('Error in listDocuments test:', error);
  }
}

async function testGetComments() {
  // Initialize DocumentManager
  const docManager = new DocumentManager({
    provider: ProviderType.GOOGLE_DRIVE,
    config: config
  });

  try {
    console.log('Testing getComments function...');

    // Use an existing document ID that might have comments
    const documentId = '17rgRPjXlZ7Juj9GTezjI0iUsFsET00eL5i0eVyCMpqg'; // Replace with a valid file ID

    console.log(`Getting comments for document: ${documentId}`);
    const comments = await docManager.getComments(documentId);

    console.log(`Found ${comments.length} comments:`);
    
    if (comments.length === 0) {
      console.log('  No comments found on this document');
    } else {
      comments.forEach((comment, index) => {
        console.log(`  ${index + 1}. Comment by ${comment.author}:`);
        console.log(`     Content: ${comment.content}`);
        console.log(`     Created: ${comment.created_at}`);
        console.log(`     Resolved: ${comment.resolved}`);
        
        if (comment.replies && comment.replies.length > 0) {
          console.log(`     Replies (${comment.replies.length}):`);
          comment.replies.forEach((reply, replyIndex) => {
            console.log(`       ${replyIndex + 1}. ${reply.author}: ${reply.content}`);
            console.log(`          Created: ${reply.created_at}`);
          });
        }
        console.log(''); // Empty line for readability
      });
    }

    console.log('✅ getComments test completed successfully');
  } catch (error) {
    console.error('Error in getComments test:', error);
  }
}

async function testGetRevisions() {
  // Initialize DocumentManager
  const docManager = new DocumentManager({
    provider: ProviderType.GOOGLE_DRIVE,
    config: config
  });

  try {
    console.log('Testing getRevisions function...');

    // Use an existing document ID that might have revisions
    const documentId = '17rgRPjXlZ7Juj9GTezjI0iUsFsET00eL5i0eVyCMpqg'; // Replace with a valid file ID

    console.log(`Getting revisions for document: ${documentId}`);
    const revisions = await docManager.getRevisions(documentId);

    console.log(`Found ${revisions.length} revisions:`);
    
    if (revisions.length === 0) {
      console.log('  No revisions found for this document');
    } else {
      revisions.forEach((revision, index) => {
        console.log(`  ${index + 1}. Revision ID: ${revision.revision_id}`);
        console.log(`     Modified Time: ${revision.modified_time}`);
        console.log(`     Modified By: ${revision.modified_by}`);
        
        if (revision.export_links && Object.keys(revision.export_links).length > 0) {
          console.log(`     Export Links:`);
          Object.entries(revision.export_links).forEach(([format, url]) => {
            console.log(`       ${format}: ${url}`);
          });
        } else {
          console.log(`     Export Links: None available`);
        }
        console.log(''); // Empty line for readability
      });
    }

    console.log('✅ getRevisions test completed successfully');
  } catch (error) {
    console.error('Error in getRevisions test:', error);
  }
}

async function testSetPermissions() {
  // Initialize DocumentManager
  const docManager = new DocumentManager({
    provider: ProviderType.GOOGLE_DRIVE,
    config: config
  });

  try {
    // Use an existing document ID to set permissions on
    const documentId = '17rgRPjXlZ7Juj9GTezjI0iUsFsET00eL5i0eVyCMpqg'; // Replace with a valid file ID

    console.log('Setting permissions...');
    await docManager.setAccessControl(documentId, [
      { user: 'emma.student@greydls.com', access_level: 'read' },
      { user: 'maria.teacher@greydls.com', access_level: 'comment' },
      { user: 'nimit.jain@comprotechnologies.com', access_level: 'read_write' }
    ]);
    console.log('✅ Permissions set successfully on:', documentId);
  } catch (error) {
    console.error('Error setting permissions:', error);
  }
}

// Run the tests
async function runTests() {
  console.log('=== Running Document Management Tests ===\n');

  console.log('1. Testing getDocument...');
  //   await testGetDocument();

  console.log('\n2. Testing createDocument...');
  // await testCreateDocument();

  console.log('\n3. Testing updateDocument...');
  // await testUpdateDocument();

  console.log('\n4. Testing deleteDocument...');
  // await testDeleteDocument();

  console.log('\n5. Testing listDocuments...');
  // await testListDocuments();

  console.log('\n6. Testing getComments...');
  // await testGetComments();

  console.log('\n7. Testing getRevisions...');
  await testGetRevisions();

  console.log('\n8. Testing setPermissions...');
  // await testSetPermissions();

  console.log('\n=== All tests completed ===');
}

runTests().catch(console.error);

// npx ts-node testing/test
