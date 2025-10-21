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

// Run the tests
async function runTests() {
  console.log('=== Running Document Management Tests ===\n');
  
  console.log('1. Testing getDocument...');
//   await testGetDocument();
  
  console.log('\n2. Testing createDocument...');
  // await testCreateDocument();
  
  console.log('\n3. Testing updateDocument...');
  await testUpdateDocument();
  
  console.log('\n=== All tests completed ===');
}

runTests().catch(console.error);



// npx ts-node testing/test