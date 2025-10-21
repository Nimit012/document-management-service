import { DocumentManager } from '../src/DocumentManager';
import { ProviderType } from '../src/types/provider.types';
// Replace with your actual Google Drive service account credentials
const config: any = {
  serviceAccountKey: {
 
  },
  adminEmail: "sarah.admin@greydls.com"
};

async function testCreateDocument() {
  // Initialize DocumentManager
  const docManager = new DocumentManager({
    provider: ProviderType.GOOGLE_DRIVE,
    config: config
  });

  // Call createDocument function
  const result = await docManager.createDocument({
    source_reference: "1EH8Hi-neBTEbSU3bkbmpJfsdpQfCMvxzP_rD4B6D-ls", // Replace with actual Google Drive file ID
    source_owner: "maria.teacher@greydls.com", // Email of document owner
    name: "Master Copy of assignment",
    folder_path: "test-folder", // Optional
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
    const documentId = "17rgRPjXlZ7Juj9GTezjI0iUsFsET00eL5i0eVyCMpqg"; // Replace with actual Google Drive file ID
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
    const documentId = "17rgRPjXlZ7Juj9GTezjI0iUsFsET00eL5i0eVyCMpqg"; // Replace with actual Google Drive file ID
    
    
    // Test updating both name and metadata
    console.log('Testing combined update...');
    const combinedUpdateResult = await docManager.updateDocument(documentId, {
      name: "Final Updated Document Name",
      metadata: {
        finalUpdate: true,
        updateTimestamp: Date.now(),
        testStatus: "completed"
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

    const documentIdToDelete = '1codXWTIwhGvOLkHudyG75EB5KQlo_AURvYmdYjEMgkE'
    

    // Delete the document
    console.log('Deleting document...');
    await docManager.deleteDocument(documentIdToDelete);
    console.log('✅ Document successfully deleted:', documentIdToDelete);
 
    
  } catch (error) {
    console.error('Error in delete document test:', error);
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
    const documentId = "17rgRPjXlZ7Juj9GTezjI0iUsFsET00eL5i0eVyCMpqg"; // Replace with a valid file ID

    console.log('Setting permissions...');
    await docManager.setAccessControl(documentId, [
      { user: 'emma.student@greydls.com', access_level: 'read' },
      { user: 'maria.teacher@greydls.com', access_level: 'comment' },
      { user: 'nimit.jain@comprotechnologies.com', access_level: 'read_write' },
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
  
  console.log('\n5. Testing setPermissions...');
  await testSetPermissions();
  
  console.log('\n=== All tests completed ===');
}

runTests().catch(console.error);



// npx ts-node testing/test