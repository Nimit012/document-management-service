"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const types_1 = require("./src/types");
const validators_1 = require("./utils/validators");
// Test 1: Valid request
console.log('Test 1: Valid request');
try {
    const validRequest = {
        provider: 'google_drive',
        source_reference: '1a2b3c4d5e6f',
        impersonate_user_email: 'teacher@school.edu',
        name: 'Test Document',
        folder_path: 'course/unit1',
        access_control: [
            { user: 'student@school.edu', access_level: 'read_write' }
        ],
        metadata: { activity_id: 'act_123' }
    };
    (0, validators_1.validateCreateRequest)(validRequest);
    console.log('✅ Valid request passed');
}
catch (error) {
    console.error('❌ Valid request failed:', error);
}
// Test 2: Missing impersonate_user_email
console.log('\nTest 2: Missing impersonate_user_email');
try {
    const invalidRequest = {
        provider: 'google_drive',
        source_reference: '1a2b3c4d5e6f',
    };
    (0, validators_1.validateCreateRequest)(invalidRequest);
    console.log('❌ Should have thrown error');
}
catch (error) {
    if (error instanceof types_1.ValidationError) {
        console.log('✅ Caught expected error:', error.message);
    }
    else {
        console.error('❌ Wrong error type:', error);
    }
}
// Test 3: Invalid email
console.log('\nTest 3: Invalid email');
try {
    const invalidRequest = {
        provider: 'google_drive',
        source_reference: '1a2b3c4d5e6f',
        impersonate_user_email: 'not-an-email',
    };
    (0, validators_1.validateCreateRequest)(invalidRequest);
    console.log('❌ Should have thrown error');
}
catch (error) {
    if (error instanceof types_1.ValidationError) {
        console.log('✅ Caught expected error:', error.message);
    }
    else {
        console.error('❌ Wrong error type:', error);
    }
}
// Test 4: Invalid access_level
console.log('\nTest 4: Invalid access_level');
try {
    const invalidRequest = {
        provider: 'google_drive',
        source_reference: '1a2b3c4d5e6f',
        impersonate_user_email: 'teacher@school.edu',
        access_control: [
            { user: 'student@school.edu', access_level: 'invalid' }
        ]
    };
    (0, validators_1.validateCreateRequest)(invalidRequest);
    console.log('❌ Should have thrown error');
}
catch (error) {
    if (error instanceof types_1.ValidationError) {
        console.log('✅ Caught expected error:', error.message);
    }
    else {
        console.error('❌ Wrong error type:', error);
    }
}
console.log('\n✅ All validator tests completed!');
//# sourceMappingURL=test-setup.js.map