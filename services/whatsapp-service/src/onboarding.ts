/**
 * Barrel re-export for backward compatibility.
 * All logic has been decomposed into onboarding/ submodules.
 */
export { routeOnboardingMessage } from './onboarding/index';
export type { OnboardingState, OnboardingSession, MessageContext } from './onboarding/types';
export { getOrCreateSession, updateSession } from './onboarding/session';
export { handleWelcome } from './onboarding/states/welcome';
export { handlePersonalInfo } from './onboarding/states/personal-info';
export { handleEmployment } from './onboarding/states/employment-info';
export { handleProductSelection } from './onboarding/states/product-selection';
export { handleKYCIdUpload, handleKYCSelfieUpload } from './onboarding/states/kyc-upload';
export { handleCreditScoring } from './onboarding/states/credit-scoring';
export { handleLoanOffer, handleTermsAcceptance } from './onboarding/states/loan-offer';
export { resumeOnboardingAfterKYC } from './onboarding/states/kyc-processing';
export { validateZimbabwePhoneNumber } from '../../shared/utils/validation';
