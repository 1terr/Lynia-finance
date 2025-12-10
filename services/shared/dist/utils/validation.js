"use strict";
/**
 * Validation Utilities
 * Common validation functions for input data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isValidEmail = isValidEmail;
exports.isValidPhoneNumber = isValidPhoneNumber;
exports.isValidUUID = isValidUUID;
exports.isValidIMEI = isValidIMEI;
exports.isValidNationalID = isValidNationalID;
exports.validateRequired = validateRequired;
exports.sanitizePhoneNumber = sanitizePhoneNumber;
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
function isValidPhoneNumber(phone) {
    // Zimbabwe phone number format: +263 XXX XXX XXX or 0XXX XXX XXX
    const phoneRegex = /^(\+263|0)[0-9]{9}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
}
function isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
}
function isValidIMEI(imei) {
    // IMEI is 15 digits
    const imeiRegex = /^[0-9]{15}$/;
    return imeiRegex.test(imei);
}
function isValidNationalID(id) {
    // Zimbabwe National ID format: XX-XXXXXXX X XX
    const nationalIdRegex = /^[0-9]{2}-[0-9]{7}[A-Z][0-9]{2}$/;
    return nationalIdRegex.test(id);
}
function validateRequired(data, requiredFields) {
    const errors = {};
    for (const field of requiredFields) {
        if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
            errors[field] = `${field} is required`;
        }
    }
    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}
function sanitizePhoneNumber(phone) {
    // Remove spaces and convert to Zimbabwe format (+263XXXXXXXXX)
    let sanitized = phone.replace(/\s/g, '');
    if (sanitized.startsWith('0')) {
        sanitized = '+263' + sanitized.substring(1);
    }
    else if (!sanitized.startsWith('+')) {
        sanitized = '+263' + sanitized;
    }
    return sanitized;
}
//# sourceMappingURL=validation.js.map