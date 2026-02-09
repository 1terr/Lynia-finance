/**
 * AWS X-Ray Tracing Utility
 * Provides helpers for adding custom annotations and metadata to X-Ray traces.
 * Traces are automatically captured by Lambda runtime when Tracing: Active is set.
 */

import AWSXRay from 'aws-xray-sdk-core';

/**
 * Initialize X-Ray tracing. Call this at module level in each Lambda handler.
 * Automatically instruments HTTP calls and AWS SDK calls.
 */
export function initTracing(): void {
  // Only enable in AWS Lambda environment
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
    AWSXRay.setContextMissingStrategy('LOG_ERROR');
    return;
  }

  // Capture all outgoing HTTP/HTTPS calls
  AWSXRay.captureHTTPsGlobal(require('http'));
  AWSXRay.captureHTTPsGlobal(require('https'));
}

/**
 * Add a custom annotation to the current trace segment.
 * Annotations are indexed and searchable in X-Ray console.
 * Use for key business identifiers.
 */
export function addAnnotation(key: string, value: string | number | boolean): void {
  try {
    const segment = AWSXRay.getSegment();
    const subsegment = segment?.addNewSubsegment?.('annotation') || segment;
    if (subsegment && 'addAnnotation' in subsegment) {
      subsegment.addAnnotation(key, value);
      if (subsegment !== segment && 'close' in subsegment) {
        (subsegment as AWSXRay.Subsegment).close();
      }
    }
  } catch {
    // Silently ignore if no active segment (local development)
  }
}

/**
 * Add custom metadata to the current trace segment.
 * Metadata is not indexed but can hold larger payloads.
 */
export function addMetadata(key: string, value: unknown, namespace?: string): void {
  try {
    const segment = AWSXRay.getSegment();
    if (segment && 'addMetadata' in segment) {
      segment.addMetadata(key, value, namespace || 'lynia');
    }
  } catch {
    // Silently ignore if no active segment
  }
}

/**
 * Create a custom subsegment for tracing a specific operation.
 * Returns a close function to call when the operation completes.
 */
export function startSubsegment(name: string): { close: (error?: Error) => void } {
  try {
    const segment = AWSXRay.getSegment();
    if (segment && 'addNewSubsegment' in segment) {
      const subsegment = (segment as AWSXRay.Segment).addNewSubsegment(name);
      return {
        close: (error?: Error) => {
          if (error) {
            subsegment.addError(error);
          }
          subsegment.close();
        },
      };
    }
  } catch {
    // Silently ignore
  }

  return { close: () => {} };
}

/**
 * Trace an async operation within a custom subsegment.
 */
export async function traceAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const sub = startSubsegment(name);
  try {
    const result = await fn();
    sub.close();
    return result;
  } catch (error) {
    sub.close(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}

// Pre-built annotation helpers for common business operations

export const TraceAnnotations = {
  customerId: (id: string) => addAnnotation('customerId', id),
  loanId: (id: string) => addAnnotation('loanId', id),
  paymentId: (id: string) => addAnnotation('paymentId', id),
  deviceId: (id: string) => addAnnotation('deviceId', id),
  operation: (op: string) => addAnnotation('operation', op),
  provider: (name: string) => addAnnotation('provider', name),
  status: (status: string) => addAnnotation('status', status),
  amountUsd: (amount: number) => addAnnotation('amountUsd', amount),
};
