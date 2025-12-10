/**
 * Validation Utilities
 * Common validation functions for input data
 */
export declare function isValidEmail(email: string): boolean;
export declare function isValidPhoneNumber(phone: string): boolean;
export declare function isValidUUID(uuid: string): boolean;
export declare function isValidIMEI(imei: string): boolean;
export declare function isValidNationalID(id: string): boolean;
export declare function validateRequired(data: Record<string, any>, requiredFields: string[]): {
    valid: boolean;
    errors: Record<string, string>;
};
export declare function sanitizePhoneNumber(phone: string): string;
//# sourceMappingURL=validation.d.ts.map