/**
 * AWS X-Ray Tracing Utility
 * Provides helpers for adding custom annotations and metadata to X-Ray traces.
 * Traces are automatically captured by Lambda runtime when Tracing: Active is set.
 */
/**
 * Initialize X-Ray tracing. Call this at module level in each Lambda handler.
 * Automatically instruments HTTP calls and AWS SDK calls.
 */
export declare function initTracing(): void;
/**
 * Add a custom annotation to the current trace segment.
 * Annotations are indexed and searchable in X-Ray console.
 * Use for key business identifiers.
 */
export declare function addAnnotation(key: string, value: string | number | boolean): void;
/**
 * Add custom metadata to the current trace segment.
 * Metadata is not indexed but can hold larger payloads.
 */
export declare function addMetadata(key: string, value: unknown, namespace?: string): void;
/**
 * Create a custom subsegment for tracing a specific operation.
 * Returns a close function to call when the operation completes.
 */
export declare function startSubsegment(name: string): {
    close: (error?: Error) => void;
};
/**
 * Trace an async operation within a custom subsegment.
 */
export declare function traceAsync<T>(name: string, fn: () => Promise<T>): Promise<T>;
export declare const TraceAnnotations: {
    customerId: (id: string) => void;
    loanId: (id: string) => void;
    paymentId: (id: string) => void;
    deviceId: (id: string) => void;
    operation: (op: string) => void;
    provider: (name: string) => void;
    status: (status: string) => void;
    amountUsd: (amount: number) => void;
};
//# sourceMappingURL=tracing.d.ts.map