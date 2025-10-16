import { DocumentManager } from './src/DocumentManager';
import { ProviderType } from './src/types/provider.types';
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

// Run the test
testCreateDocument().catch(console.error);
