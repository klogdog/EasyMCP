# Task 6.4: Create Example Connector - Gmail

**Goal**: Build connector demonstrating OAuth2 authentication and email operations.

**Actions**:

- Create `connectors/gmail.ts` following connector pattern
- Export metadata: `{ name: 'gmail', type: 'email', authentication: { type: 'oauth2', scopes: ['gmail.readonly', 'gmail.send'] } }`
- Declare credentials: `credentials: [{ name: 'GMAIL_CLIENT_ID', required: true }, { name: 'GMAIL_CLIENT_SECRET', required: true }, { name: 'GMAIL_REFRESH_TOKEN', required: true }]`
- Implement initialization: create Gmail API client using googleapis npm package, set up OAuth2 client
- Add basic operations: `async listMessages(maxResults: number)`, `async sendEmail(to, subject, body)`, `async searchMessages(query)`
- Implement rate limiting: track requests per minute, delay if exceeding quota, respect API limits
- Add connection test: `async testConnection(): Promise<boolean>` that verifies credentials
- Include error handling: handle token expiration, quota exceeded, network errors

**Success Criteria**: Connects to Gmail API; performs email operations; handles OAuth2; respects rate limits
