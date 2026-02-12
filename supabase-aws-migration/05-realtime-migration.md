# 05 - Realtime Migration

## Current State: Supabase Realtime

### Active Subscriptions

1. **KYC Submissions Channel** (`frontend/admin-portal/src/lib/hooks/useKYCReview.ts`)
   ```typescript
   supabase
     .channel('kyc-submissions-changes')
     .on('postgres_changes', {
       event: '*',
       schema: 'public',
       table: 'kyc_submissions',
     }, () => fetchQueue())
     .subscribe();
   ```
   Purpose: Live-updates the KYC review queue when submissions change.

2. **Auth State Listener** (`frontend/distributor-dashboard/src/components/layout/auth-provider.tsx`)
   ```typescript
   supabase.auth.onAuthStateChange((event, session) => { ... });
   ```
   Purpose: Reacts to login/logout/token refresh events.

### Planned Subscriptions (from architecture docs)

- `distributor_inventory` -- real-time inventory updates
- `distributor_commissions` -- commission status changes
- `payment_callbacks` -- payment status tracking

## Target State: Options Analysis

### Option A: API Gateway WebSocket API (Recommended)

Cost-efficient, serverless, integrates with existing Lambda infrastructure.

```
┌───────────┐   WebSocket   ┌──────────────┐   Lambda    ┌──────────┐
│  Frontend  │ ────────────▶│  API Gateway  │ ──────────▶│  Lambda  │
│            │◀──────────── │  WebSocket    │◀────────── │ (notify) │
└───────────┘   Messages    └──────────────┘            └────┬─────┘
                                    │                        │
                            ┌───────▼───────┐        ┌──────▼──────┐
                            │  DynamoDB     │        │ PostgreSQL  │
                            │  (connections)│        │ (data)      │
                            └───────────────┘        └─────────────┘
```

**Cost**: $1.00 per million connection minutes + $1.00 per million messages.
At current scale (< 50 concurrent admin users), this is effectively **$0/month**.

### Option B: AppSync Subscriptions

AWS-managed GraphQL with built-in subscriptions.

**Pros**: Auto-generates resolvers, offline support, conflict resolution.
**Cons**: GraphQL adoption required (large codebase change), $4/million queries.
**Verdict**: Over-engineered for our use case.

### Option C: Server-Sent Events (SSE) via Lambda

Simple one-way push from server to client.

**Pros**: HTTP-based (no WebSocket complexity), works through all proxies.
**Cons**: Lambda timeout limits long-lived connections, needs response streaming.
**Verdict**: Viable for simple notifications but less flexible than WebSocket.

### Option D: Polling

Frontend polls API at regular intervals.

**Pros**: Simplest implementation, no new infrastructure.
**Cons**: Increased API calls, latency (5-30 second intervals), wasteful.
**Verdict**: Acceptable short-term, replace with WebSocket when traffic grows.

## Recommended Approach: Polling First, WebSocket Later

Given that only 2 realtime features are active (KYC queue + auth state), and
the admin portal has < 50 concurrent users:

**Phase 1 (Immediate)**: Replace Supabase realtime with polling

```typescript
// Replace supabase.channel() with polling
function useKYCReview() {
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    const fetchQueue = async () => {
      const response = await fetch('/api/kyc/queue', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setQueue(data);
    };

    fetchQueue(); // Initial fetch
    const interval = setInterval(fetchQueue, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return queue;
}
```

**Phase 2 (When needed)**: Add WebSocket API for real-time features

### WebSocket API Implementation (Phase 2)

#### CloudFormation Template

```yaml
# infrastructure/aws/websocket-api.yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: Lynia Finance - WebSocket API for realtime updates

Parameters:
  Environment:
    Type: String

Resources:
  WebSocketApi:
    Type: AWS::ApiGatewayV2::Api
    Properties:
      Name: !Sub "${Environment}-lynia-websocket"
      ProtocolType: WEBSOCKET
      RouteSelectionExpression: "$request.body.action"

  ConnectRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: $connect
      AuthorizationType: NONE  # Auth handled in Lambda
      Target: !Sub "integrations/${ConnectIntegration}"

  DisconnectRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: $disconnect
      Target: !Sub "integrations/${DisconnectIntegration}"

  SubscribeRoute:
    Type: AWS::ApiGatewayV2::Route
    Properties:
      ApiId: !Ref WebSocketApi
      RouteKey: subscribe
      Target: !Sub "integrations/${SubscribeIntegration}"

  # DynamoDB for connection tracking
  ConnectionsTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub "${Environment}-lynia-ws-connections"
      BillingMode: PAY_PER_REQUEST
      AttributeDefinitions:
        - AttributeName: connectionId
          AttributeType: S
        - AttributeName: channel
          AttributeType: S
      KeySchema:
        - AttributeName: connectionId
          KeyType: HASH
      GlobalSecondaryIndexes:
        - IndexName: channel-index
          KeySchema:
            - AttributeName: channel
              KeyType: HASH
          Projection:
            ProjectionType: ALL
      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true
```

#### Lambda Handlers

```typescript
// services/shared/realtime/connect.ts
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamo = new DynamoDBClient({});

export const handler = async (event: any) => {
  const connectionId = event.requestContext.connectionId;
  const token = event.queryStringParameters?.token;

  // Validate Cognito JWT token
  const user = await validateToken(token);
  if (!user) return { statusCode: 401 };

  // Store connection
  await dynamo.send(new PutItemCommand({
    TableName: process.env.CONNECTIONS_TABLE!,
    Item: {
      connectionId: { S: connectionId },
      userId: { S: user.sub },
      roles: { SS: user.groups },
      connectedAt: { S: new Date().toISOString() },
      ttl: { N: String(Math.floor(Date.now() / 1000) + 86400) }, // 24h TTL
    },
  }));

  return { statusCode: 200 };
};

// services/shared/realtime/broadcast.ts
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

export async function broadcastToChannel(
  channel: string,
  data: unknown,
  endpoint: string
) {
  const api = new ApiGatewayManagementApiClient({ endpoint });

  // Get all connections subscribed to this channel
  const connections = await getConnectionsByChannel(channel);

  const sendPromises = connections.map(async (conn) => {
    try {
      await api.send(new PostToConnectionCommand({
        ConnectionId: conn.connectionId,
        Data: Buffer.from(JSON.stringify(data)),
      }));
    } catch (err: any) {
      if (err.statusCode === 410) {
        // Connection is stale, clean up
        await removeConnection(conn.connectionId);
      }
    }
  });

  await Promise.allSettled(sendPromises);
}
```

#### Triggering Realtime Updates from Lambda Services

When a KYC submission is updated, broadcast to the admin channel:

```typescript
// In kyc-service handler, after updating a submission:
await broadcastToChannel(
  'kyc-submissions',
  { event: 'UPDATE', table: 'kyc_submissions', record: updatedSubmission },
  process.env.WEBSOCKET_ENDPOINT!
);
```

#### Frontend WebSocket Client

```typescript
// frontend/admin-portal/src/lib/hooks/useRealtimeChannel.ts
import { useEffect, useRef, useCallback } from 'react';

export function useRealtimeChannel(
  channel: string,
  onMessage: (data: any) => void
) {
  const ws = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const token = getStoredToken(); // Cognito JWT
    const url = `${process.env.NEXT_PUBLIC_WS_URL}?token=${token}`;

    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      ws.current?.send(JSON.stringify({
        action: 'subscribe',
        channel,
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    ws.current.onclose = () => {
      // Reconnect with exponential backoff
      setTimeout(connect, 3000);
    };
  }, [channel, onMessage]);

  useEffect(() => {
    connect();
    return () => ws.current?.close();
  }, [connect]);
}

// Usage in KYC review hook:
function useKYCReview() {
  const [queue, setQueue] = useState([]);

  // Initial fetch
  useEffect(() => { fetchQueue().then(setQueue); }, []);

  // Realtime updates
  useRealtimeChannel('kyc-submissions', () => {
    fetchQueue().then(setQueue); // Re-fetch on any change
  });

  return queue;
}
```

## Auth State Changes

Supabase's `onAuthStateChange` is not a database realtime feature -- it's a
client-side auth event. Cognito handles this natively:

```typescript
// Replace supabase.auth.onAuthStateChange()
import { Hub } from 'aws-amplify/utils';

Hub.listen('auth', ({ payload }) => {
  switch (payload.event) {
    case 'signedIn':
      // User signed in
      break;
    case 'signedOut':
      // User signed out
      break;
    case 'tokenRefresh':
      // Token refreshed
      break;
  }
});
```

Or with `amazon-cognito-identity-js`, simply check session validity on route
changes -- no event listener needed.

## Cost Comparison

| Approach | Monthly Cost (50 users) | Monthly Cost (500 users) |
|----------|------------------------|--------------------------|
| Supabase Realtime (free tier) | $0 | Exceeds limits |
| Polling (5s interval, 8hr/day) | ~$0.50 (API Gateway calls) | ~$5 |
| WebSocket API | < $0.10 | < $1 |
| AppSync | ~$2 | ~$20 |

**Recommendation**: Start with polling. It's free within API Gateway's existing
allocation and requires zero new infrastructure. Add WebSocket API when you
have > 100 concurrent dashboard users or need sub-second updates.
