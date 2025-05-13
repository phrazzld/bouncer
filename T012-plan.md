# T012 Plan: Implement integration tests for pre-commit hook in a temp git repo

## Objective
Create integration tests to verify Bouncer works correctly when installed as a pre-commit hook.

## Analysis
Integration testing for Bouncer as a pre-commit hook requires:
1. Setting up a complete test environment with a clean Git repo
2. Installing pre-commit in that repo
3. Configuring the Bouncer hook
4. Testing different commit scenarios
5. Validating proper behavior (pass/fail verdicts, log entries, etc.)

## Test Scenarios to Implement
1. **Basic Functionality**
   - Commit with changes that should pass Bouncer rules
   - Commit with changes that should fail Bouncer rules
   - Verify correct verdict processing

2. **Configuration**
   - Custom rules file path via pre-commit config
   - Custom environment file path
   - Custom log file path
   - Debug mode

3. **Error Handling**
   - Missing API key
   - Invalid/malformed rules file
   - Network/API errors (simulated)

## Implementation Approach
1. Create a master integration test script `test-integration.js`
2. Implement functions to:
   - Create a temporary Git repository
   - Install and configure pre-commit
   - Add the Bouncer hook to the pre-commit config
   - Create test files and commit changes
   - Verify hook behavior
   - Clean up test environment

3. Use Node.js child_process and fs APIs for Git operations
4. Create helper functions to check log files and verify behavior

## Success Criteria
1. All test scenarios pass consistently
2. Integration test can run in CI environments
3. Test covers the full pre-commit hook workflow
4. Clean setup and teardown of test environment