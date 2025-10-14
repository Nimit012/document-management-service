import {
    isValidEmail,
    validateCreateRequest,
    validateAccessControl,
    validateDocumentId,
    validateMetadata
  } from '../../../utils/validators.js';
  import { ValidationError } from '../../../src/types/index.js';
  import { mockCreateRequest, mockAccessControl } from '../../__mocks__/fixtures.js';
  
  describe('validators', () => {
    describe('isValidEmail', () => {
      it('should validate correct emails', () => {
        expect(isValidEmail('user@school.edu')).toBe(true);
        expect(isValidEmail('not-an-email')).toBe(false);
        expect(isValidEmail('')).toBe(false);
      });
    });
  
    describe('validateCreateRequest', () => {
      it('should pass for valid request', () => {
        expect(() => validateCreateRequest(mockCreateRequest)).not.toThrow();
      });
  
      it('should throw if provider is missing or invalid', () => {
        const noProvider = { ...mockCreateRequest, provider: undefined as any };
        expect(() => validateCreateRequest(noProvider)).toThrow('provider is required');
  
        const invalidProvider = { ...mockCreateRequest, provider: 'azure' as any };
        expect(() => validateCreateRequest(invalidProvider)).toThrow('provider must be');
      });
  
      it('should throw if source_reference is missing or empty', () => {
        const noSource = { ...mockCreateRequest, source_reference: undefined as any };
        expect(() => validateCreateRequest(noSource)).toThrow('source_reference is required');
  
        const emptySource = { ...mockCreateRequest, source_reference: '' };
        expect(() => validateCreateRequest(emptySource)).toThrow('non-empty string');
      });
  
      it('should throw if source_owner is missing or invalid email', () => {
        const noOwner = { ...mockCreateRequest, source_owner: undefined as any };
        expect(() => validateCreateRequest(noOwner)).toThrow('source_owner is required');
  
        const invalidEmail = { ...mockCreateRequest, source_owner: 'not-email' };
        expect(() => validateCreateRequest(invalidEmail)).toThrow('valid email');
      });
  
      it('should validate nested access_control', () => {
        const invalidAC = { ...mockCreateRequest, access_control: {} as any };
        expect(() => validateCreateRequest(invalidAC)).toThrow('must be an array');
      });
  
      it('should validate metadata type', () => {
        const invalidMeta = { ...mockCreateRequest, metadata: 'string' as any };
        expect(() => validateCreateRequest(invalidMeta)).toThrow('must be an object');
      });
    });
  
    describe('validateAccessControl', () => {
      it('should pass for valid access control', () => {
        expect(() => validateAccessControl(mockAccessControl)).not.toThrow();
      });
  
      it('should throw if not an array', () => {
        expect(() => validateAccessControl({} as any)).toThrow('must be an array');
      });
  
      it('should throw if user email is invalid', () => {
        const invalid = [{ user: 'not-email', access_level: 'read' }];
        expect(() => validateAccessControl(invalid)).toThrow('valid email');
      });
  
      it('should throw if access_level is invalid', () => {
        const invalid = [{ user: 'user@test.com', access_level: 'invalid' }] as any;
        expect(() => validateAccessControl(invalid)).toThrow('must be "read", "read_write", or "comment"');
      });
    });
  
    describe('validateDocumentId', () => {
      it('should pass for valid ID', () => {
        expect(() => validateDocumentId('doc_123')).not.toThrow();
      });
  
      it('should throw for empty or invalid ID', () => {
        expect(() => validateDocumentId('')).toThrow('non-empty string');
        expect(() => validateDocumentId(undefined as any)).toThrow('required');
      });
    });
  
    describe('validateMetadata', () => {
      it('should pass for valid metadata', () => {
        expect(() => validateMetadata({ key: 'value', count: 5, active: true })).not.toThrow();
      });
  
      it('should throw if not an object', () => {
        expect(() => validateMetadata('string' as any)).toThrow('must be an object');
        expect(() => validateMetadata(null as any)).toThrow('must be an object');
      });
  
      it('should throw for non-serializable values', () => {
        expect(() => validateMetadata({ func: () => {} })).toThrow('must be a string, number, boolean, or null');
        expect(() => validateMetadata({ nested: { key: 'value' } })).toThrow('must be a string, number, boolean, or null');
      });
    });
  });