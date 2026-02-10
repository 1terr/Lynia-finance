"use strict";
/**
 * AWS X-Ray Tracing Utility
 * Provides helpers for adding custom annotations and metadata to X-Ray traces.
 * Traces are automatically captured by Lambda runtime when Tracing: Active is set.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TraceAnnotations = void 0;
exports.initTracing = initTracing;
exports.addAnnotation = addAnnotation;
exports.addMetadata = addMetadata;
exports.startSubsegment = startSubsegment;
exports.traceAsync = traceAsync;
const aws_xray_sdk_core_1 = __importDefault(require("aws-xray-sdk-core"));
/**
 * Initialize X-Ray tracing. Call this at module level in each Lambda handler.
 * Automatically instruments HTTP calls and AWS SDK calls.
 */
function initTracing() {
    // Only enable in AWS Lambda environment
    if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
        aws_xray_sdk_core_1.default.setContextMissingStrategy('LOG_ERROR');
        return;
    }
    // Capture all outgoing HTTP/HTTPS calls
    aws_xray_sdk_core_1.default.captureHTTPsGlobal(require('http'));
    aws_xray_sdk_core_1.default.captureHTTPsGlobal(require('https'));
}
/**
 * Add a custom annotation to the current trace segment.
 * Annotations are indexed and searchable in X-Ray console.
 * Use for key business identifiers.
 */
function addAnnotation(key, value) {
    try {
        const segment = aws_xray_sdk_core_1.default.getSegment();
        const subsegment = segment?.addNewSubsegment?.('annotation') || segment;
        if (subsegment && 'addAnnotation' in subsegment) {
            subsegment.addAnnotation(key, value);
            if (subsegment !== segment && 'close' in subsegment) {
                subsegment.close();
            }
        }
    }
    catch {
        // Silently ignore if no active segment (local development)
    }
}
/**
 * Add custom metadata to the current trace segment.
 * Metadata is not indexed but can hold larger payloads.
 */
function addMetadata(key, value, namespace) {
    try {
        const segment = aws_xray_sdk_core_1.default.getSegment();
        if (segment && 'addMetadata' in segment) {
            segment.addMetadata(key, value, namespace || 'lynia');
        }
    }
    catch {
        // Silently ignore if no active segment
    }
}
/**
 * Create a custom subsegment for tracing a specific operation.
 * Returns a close function to call when the operation completes.
 */
function startSubsegment(name) {
    try {
        const segment = aws_xray_sdk_core_1.default.getSegment();
        if (segment && 'addNewSubsegment' in segment) {
            const subsegment = segment.addNewSubsegment(name);
            return {
                close: (error) => {
                    if (error) {
                        subsegment.addError(error);
                    }
                    subsegment.close();
                },
            };
        }
    }
    catch {
        // Silently ignore
    }
    return { close: () => { } };
}
/**
 * Trace an async operation within a custom subsegment.
 */
async function traceAsync(name, fn) {
    const sub = startSubsegment(name);
    try {
        const result = await fn();
        sub.close();
        return result;
    }
    catch (error) {
        sub.close(error instanceof Error ? error : new Error(String(error)));
        throw error;
    }
}
// Pre-built annotation helpers for common business operations
exports.TraceAnnotations = {
    customerId: (id) => addAnnotation('customerId', id),
    loanId: (id) => addAnnotation('loanId', id),
    paymentId: (id) => addAnnotation('paymentId', id),
    deviceId: (id) => addAnnotation('deviceId', id),
    operation: (op) => addAnnotation('operation', op),
    provider: (name) => addAnnotation('provider', name),
    status: (status) => addAnnotation('status', status),
    amountUsd: (amount) => addAnnotation('amountUsd', amount),
};
//# sourceMappingURL=tracing.js.map