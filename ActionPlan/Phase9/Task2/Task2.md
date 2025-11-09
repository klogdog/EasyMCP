# Task 9.2: Write Unit Tests - Loader

**Goal**: Test module loading and discovery functionality.

**Actions**:

- Create `base/__tests__/loader.test.ts`
- Test module discovery: mock fs with sample tools, verify loadModules finds all .ts/.py files
- Test file filtering: verify non-matching extensions ignored, hidden files skipped
- Test metadata extraction: verify name, description, dependencies correctly parsed from different formats
- Test error handling: malformed metadata, missing files, unreadable files - should log warning and continue
- Test edge cases: empty directories, symlinks, nested directories, very long paths
- Mock file system: use memfs or mock fs.promises for fast, isolated tests
- Aim for >90% coverage of loader.ts

**Success Criteria**: Comprehensive test coverage; tests pass; edge cases covered; runs fast (<1s)
