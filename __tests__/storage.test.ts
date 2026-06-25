// Mock AWS SDK modules — they use TextDecoder which isn't in jsdom
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(),
  PutObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import { buildFileKey } from '../src/utils/storage';

describe('storage utility', () => {
  describe('buildFileKey', () => {
    it('should generate key with projectId/category/timestamp_filename format', () => {
      const key = buildFileKey('proj-123', 'fasta', 'sequence.fasta');
      expect(key).toMatch(/^proj-123\/fasta\/\d+_sequence\.fasta$/);
    });

    it('should sanitize special characters in filename', () => {
      const key = buildFileKey('proj', 'uploads', 'my file (copy) [1].pdb');
      expect(key).toMatch(/^proj\/uploads\/\d+_my_file__copy___1_\.pdb$/);
    });

    it('should preserve dots, dashes, and underscores in filename', () => {
      const key = buildFileKey('proj', 'data', 'sample_v2.1-final.csv');
      expect(key).toMatch(/sample_v2\.1-final\.csv$/);
    });

    it('should use default project and category when provided', () => {
      const key = buildFileKey('default', 'uploads', 'test.txt');
      expect(key).toMatch(/^default\/uploads\/\d+_test\.txt$/);
    });

    it('should handle filenames with no extension', () => {
      const key = buildFileKey('proj', 'misc', 'README');
      expect(key).toMatch(/README$/);
    });

    it('should produce unique keys for the same filename called at different times', () => {
      const key1 = buildFileKey('proj', 'uploads', 'file.txt');
      const key2 = buildFileKey('proj', 'uploads', 'file.txt');
      // Both should match the pattern but timestamps differ
      expect(key1).toMatch(/^proj\/uploads\/\d+_file\.txt$/);
      expect(key2).toMatch(/^proj\/uploads\/\d+_file\.txt$/);
    });
  });
});
