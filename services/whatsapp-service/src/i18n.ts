/**
 * Multi-Language Support for WhatsApp Service (P3-T016)
 *
 * Supported Languages:
 *  - English (en)
 *  - Shona (sn)
 *  - Ndebele (nd)
 *
 * Features:
 *  - Translation lookup with fallback to English
 *  - Language detection from user messages
 *  - Per-customer language preference persistence
 *  - Simple 8th-grade reading level (financial inclusion)
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ===================================================================
// TYPE DEFINITIONS
// ===================================================================

export type SupportedLanguage = 'en' | 'sn' | 'nd';

export type TranslationKey =
  | 'welcome'
  | 'welcome_name'
  | 'ask_name'
  | 'ask_dob'
  | 'ask_gender'
  | 'ask_location'
  | 'ask_employment'
  | 'ask_income'
  | 'ask_debts'
  | 'ask_household'
  | 'personal_info_complete'
  | 'income_info_complete'
  | 'product_selection'
  | 'kyc_id_upload'
  | 'kyc_selfie'
  | 'kyc_verified'
  | 'kyc_failed'
  | 'approved'
  | 'rejected'
  | 'manual_review'
  | 'terms_header'
  | 'terms_accept'
  | 'onboarding_complete'
  | 'balance_header'
  | 'payment_due'
  | 'payment_received'
  | 'device_locked'
  | 'device_unlocked'
  | 'help_menu'
  | 'error_generic'
  | 'language_select'
  | 'language_changed'
  | 'invalid_input'
  | 'male'
  | 'female'
  | 'other';

// ===================================================================
// TRANSLATION DICTIONARIES
// ===================================================================

const translations: Record<SupportedLanguage, Record<TranslationKey, string>> = {
  en: {
    welcome: 'Welcome to Lynia Finance!\n\nGet a smartphone today, pay over 6-8 months.\n\n✅ No credit history needed\n✅ Fast approval (<10 min)\n✅ Flexible payment plans',
    welcome_name: 'Hi {{name}}! Welcome back.',
    ask_name: "Let's get started! What's your full name?\n(as it appears on your National ID)\n\nExample: *Tendai Mukanya Moyo*",
    ask_dob: 'What is your date of birth?\n\nFormat: *DD/MM/YYYY*\nExample: *15/03/1990*',
    ask_gender: 'What is your gender?\n\nReply:\n1 - Male\n2 - Female\n3 - Other',
    ask_location: 'What city or town do you live in?\n\nExamples: *Harare*, *Bulawayo*, *Mutare*',
    ask_employment: 'What type of work do you do?\n\nExamples:\n• Formal employment\n• Self-employed\n• Informal trader\n• Driver (Uber/Bolt)',
    ask_income: 'What is your average monthly income (in USD)?\n\nPlease enter a number:\nExample: *350*',
    ask_debts: 'Do you have any existing debts? (loans, rent, etc.)\n\nEnter monthly amount in USD, or *0* if none.',
    ask_household: 'How many people live in your household?\n(including yourself)\n\nExample: *3*',
    personal_info_complete: '✅ *Personal Info Complete!*\n\nNow let us talk about your income.',
    income_info_complete: '✅ *Income Info Complete!*',
    product_selection: 'What would you like to apply for?\n\n1 - Smartphone Financing 📱\n2 - Digital Credit 💰 (Coming Soon)',
    kyc_id_upload: '📸 Upload your National ID photo.\n\nTips:\n✅ Place ID on flat surface\n✅ Good lighting\n✅ All text visible',
    kyc_selfie: '📸 Take a selfie.\n\nTips:\n✅ Face the camera directly\n✅ Remove sunglasses/hat\n✅ Good lighting',
    kyc_verified: '✅ *Identity Verified!*',
    kyc_failed: '❌ Verification failed. Please try again.',
    approved: '🎉 *Congratulations! You are Approved!*',
    rejected: '❌ Application not approved at this time.',
    manual_review: '⏸️ Manual review required (up to 24 hours).',
    terms_header: '📄 *Loan Terms & Conditions*',
    terms_accept: 'Reply *I ACCEPT* to accept the loan terms.',
    onboarding_complete: '✅ *Onboarding Complete!*\n\nVisit your nearest distributor to collect your device.',
    balance_header: '💰 *Loan Balance*',
    payment_due: 'Your payment of ${{amount}} is due on {{date}}.',
    payment_received: '✅ Payment of ${{amount}} received. Thank you!',
    device_locked: '🔒 Your device is locked due to overdue payment.',
    device_unlocked: '🔓 Your device is unlocked and active.',
    help_menu: '📱 *Available Commands*\n\nBALANCE - Check balance\nHISTORY - Payment history\nSCHEDULE - Payment schedule\nDEVICE - Device status\nHELP - This menu',
    error_generic: '⚠️ Something went wrong. Please try again or contact support@lynia.finance',
    language_select: '🌐 *Choose your language:*\n\n1 - English\n2 - Shona\n3 - Ndebele',
    language_changed: 'Language changed to *{{language}}*.',
    invalid_input: 'Invalid input. Please try again.',
    male: 'Male',
    female: 'Female',
    other: 'Other',
  },
  sn: {
    welcome: 'Mauya kuLynia Finance!\n\nTora smartphone nhasi, ubhadhare kwemwedzi 6-8.\n\n✅ Hapana credit history inodiwa\n✅ Kupihwa nekukurumidza (<10 min)\n✅ Payment plans dzinochinjika',
    welcome_name: 'Mhoro {{name}}! Mauya zvakare.',
    ask_name: "Ngatitangei! Zita rako rizere ndiani?\n(sezvazviri paID yeNational)\n\nMuenzaniso: *Tendai Mukanya Moyo*",
    ask_dob: 'Wakazvarwa riini?\n\nShandisa: *DD/MM/YYYY*\nMuenzaniso: *15/03/1990*',
    ask_gender: 'Munhu rudzii?\n\nPindura:\n1 - Murume\n2 - Mukadzi\n3 - Zvimwe',
    ask_location: 'Unogara muguta ripi?\n\nMienzaniso: *Harare*, *Bulawayo*, *Mutare*',
    ask_employment: 'Unoita basa rei?\n\nMienzaniso:\n• Mushandi wekukambani\n• Unozvishanda\n• Mutengesi\n• Mutyairi (Uber/Bolt)',
    ask_income: 'Mari yako yemwedzi ndeipi (muUSD)?\n\nNyora nhamba:\nMuenzaniso: *350*',
    ask_debts: 'Une chikwereti here? (loan, rent, nezvimwe)\n\nNyora mari yemwedzi muUSD, kana *0* kana usina.',
    ask_household: 'Vanhu vangani vanogara pamba pako?\n(kusanganisira iwewe)\n\nMuenzaniso: *3*',
    personal_info_complete: '✅ *Ruzivo Rwako Rwapera!*\n\nIkozvino ngatitaurei nezvemari yako.',
    income_info_complete: '✅ *Ruzivo Rwemari Rwapera!*',
    product_selection: 'Chii chaunoda kutenga?\n\n1 - Smartphone 📱\n2 - Mari Yekubatsira 💰 (Iri kuuya)',
    kyc_id_upload: '📸 Tora pikicha yeID yako.\n\nMashoko:\n✅ Isa ID pamusoro\n✅ Chiedza chakanaka\n✅ Mashoko ese anoonekaoneka',
    kyc_selfie: '📸 Tora selfie yako.\n\nMashoko:\n✅ Tarisa kamera\n✅ Bvisa magirazi\n✅ Chiedza chakanaka',
    kyc_verified: '✅ *Waverifywa!*',
    kyc_failed: '❌ Verification harishande. Edza zvakare.',
    approved: '🎉 *Makorokoto! Wabvumirwa!*',
    rejected: '❌ Application haina kubvumirwa panguva ino.',
    manual_review: '⏸️ Iri kucheckerwa (kusvika maawa 24).',
    terms_header: '📄 *Mitemo yeLoan*',
    terms_accept: 'Pindura *NDINOBVUMA* kuti ubvume mitemo.',
    onboarding_complete: '✅ *Wapedza!*\n\nShanyira distributor yepedyo kutora phone yako.',
    balance_header: '💰 *Loan Balance*',
    payment_due: 'Payment yako ye${{amount}} iri kudiwa pa{{date}}.',
    payment_received: '✅ Payment ye${{amount}} yagamuchirwa. Mazvita!',
    device_locked: '🔒 Phone yako yakalockerwa nekuda kwepayment yakapfuura.',
    device_unlocked: '🔓 Phone yako yakavhurwa uye inoshanda.',
    help_menu: '📱 *Macommand Anowanika*\n\nBALANCE - Checker balance\nHISTORY - Payment history\nSCHEDULE - Payment schedule\nDEVICE - Device status\nHELP - Menu iyi',
    error_generic: '⚠️ Pane chakanganisika. Edza zvakare kana utaure nesupport@lynia.finance',
    language_select: '🌐 *Sarudza mutauro wako:*\n\n1 - English\n2 - Shona\n3 - Ndebele',
    language_changed: 'Mutauro wachinjwa kuita *{{language}}*.',
    invalid_input: 'Hazvina kubatana. Edza zvakare.',
    male: 'Murume',
    female: 'Mukadzi',
    other: 'Zvimwe',
  },
  nd: {
    welcome: 'Siyalemukela kuLynia Finance!\n\nThola i-smartphone lamuhla, ubhadale ngenyanga ezingu 6-8.\n\n✅ Kakudingi i-credit history\n✅ Ukuphathwa ngokushesha (<10 min)\n✅ Amapulani okubhadala atshintshekayo',
    welcome_name: 'Sawubona {{name}}! Siyalemukela futhi.',
    ask_name: "Asiqaleni! Ibizo lakho eligcweleyo ngubani?\n(njengoba libhalwe ku-ID yakho)\n\nIsibonelo: *Tendai Mukanya Moyo*",
    ask_dob: 'Wazalwa nini?\n\nSebenzisa: *DD/MM/YYYY*\nIsibonelo: *15/03/1990*',
    ask_gender: 'Ngumuntu onjani?\n\nPhendula:\n1 - Indoda\n2 - Umfazi\n3 - Okunye',
    ask_location: 'Uhlala edolobheni eliphi?\n\nIzibonelo: *Harare*, *Bulawayo*, *Mutare*',
    ask_employment: 'Wenza msebenzi bani?\n\nIzibonelo:\n• Umsebenzi wenkampani\n• Uzisebenzela\n• Umthengisi\n• Umtshayeli (Uber/Bolt)',
    ask_income: 'Imali yakho yenyanga yimalini (nge-USD)?\n\nBhala inombolo:\nIsibonelo: *350*',
    ask_debts: 'Ulesikwelede yini? (i-loan, i-rent, lokunye)\n\nBhala imali yenyanga nge-USD, kumbe *0* nxa ungela.',
    ask_household: 'Bangaki abantu abahlala endlini yakho?\n(kufaka lawe)\n\nIsibonelo: *3*',
    personal_info_complete: '✅ *Ulwazi Lwakho Luphelile!*\n\nKhathesi ake sikhulume ngemali yakho.',
    income_info_complete: '✅ *Ulwazi Lwemali Luphelile!*',
    product_selection: 'Ufuna ukuthengani?\n\n1 - I-Smartphone 📱\n2 - Imali Yokusiza 💰 (Iyeza)',
    kyc_id_upload: '📸 Thatha isithombe se-ID yakho.\n\nAmacebo:\n✅ Beka i-ID phansi\n✅ Ukukhanya okuhle\n✅ Wonke amagama abonakale',
    kyc_selfie: '📸 Thatha i-selfie yakho.\n\nAmacebo:\n✅ Khangela ikhamera\n✅ Susa izibuko zelanga\n✅ Ukukhanya okuhle',
    kyc_verified: '✅ *Uqinisekisiwe!*',
    kyc_failed: '❌ Ukuqinisekisa akuphumelelanga. Zama futhi.',
    approved: '🎉 *Halala! Uvunyelwe!*',
    rejected: '❌ Isicelo asivunyelwanga ngalesisikhathi.',
    manual_review: '⏸️ Kuyahlolwa (kuze kube ngamahora angu-24).',
    terms_header: '📄 *Imithetho ye-Loan*',
    terms_accept: 'Phendula *NGIYAVUMA* ukuvuma imithetho.',
    onboarding_complete: '✅ *Uqedile!*\n\nHambela ku-distributor eseduze ukuthatha ifoni yakho.',
    balance_header: '💰 *I-Loan Balance*',
    payment_due: 'I-payment yakho ye-${{amount}} ifuneka nge-{{date}}.',
    payment_received: '✅ I-payment ye-${{amount}} itholiwe. Siyabonga!',
    device_locked: '🔒 Ifoni yakho ivaliwe ngenxa ye-payment edlulelwe.',
    device_unlocked: '🔓 Ifoni yakho ivuliwe futhi iyasebenza.',
    help_menu: '📱 *Ama-command Atholakalayo*\n\nBALANCE - Hlola i-balance\nHISTORY - I-payment history\nSCHEDULE - I-payment schedule\nDEVICE - I-device status\nHELP - Le-menu',
    error_generic: '⚠️ Kukhona okungahambanga kahle. Zama futhi kumbe uthinte support@lynia.finance',
    language_select: '🌐 *Khetha ulimi lwakho:*\n\n1 - English\n2 - Shona\n3 - Ndebele',
    language_changed: 'Ulimi luguqulwe lwaba yi-*{{language}}*.',
    invalid_input: 'Okufakiweyo akulunganga. Zama futhi.',
    male: 'Indoda',
    female: 'Umfazi',
    other: 'Okunye',
  },
};

// ===================================================================
// TRANSLATION FUNCTIONS
// ===================================================================

/**
 * Get translation for a key in the specified language
 */
export function t(
  key: TranslationKey,
  language: SupportedLanguage = 'en',
  params?: Record<string, string>
): string {
  let text = translations[language]?.[key] || translations.en[key] || key;

  // Replace template variables
  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), value);
    }
  }

  return text;
}

/**
 * Detect language from user input keywords
 */
export function detectLanguage(input: string): SupportedLanguage | null {
  const lower = input.toLowerCase().trim();

  // Shona keywords
  const shonaWords = ['mhoro', 'maswera', 'ndinotenda', 'ndapota', 'hongu', 'kwete', 'ehe', 'aiwa'];
  if (shonaWords.some(w => lower.includes(w))) return 'sn';

  // Ndebele keywords
  const ndebeleWords = ['sawubona', 'ngiyabonga', 'yebo', 'hatshi', 'siyabonga', 'ngicela'];
  if (ndebeleWords.some(w => lower.includes(w))) return 'nd';

  return null;
}

/**
 * Parse language selection from numbered input
 */
export function parseLanguageSelection(input: string): SupportedLanguage | null {
  const trimmed = input.trim().toLowerCase();
  if (trimmed === '1' || trimmed === 'english' || trimmed === 'en') return 'en';
  if (trimmed === '2' || trimmed === 'shona' || trimmed === 'sn') return 'sn';
  if (trimmed === '3' || trimmed === 'ndebele' || trimmed === 'nd') return 'nd';
  return null;
}

/**
 * Get customer's preferred language from database
 */
export async function getCustomerLanguage(phoneNumber: string): Promise<SupportedLanguage> {
  const { data } = await supabase
    .from('customer_preferences')
    .select('preferred_language, customers!inner(phone_number)')
    .eq('customers.phone_number', phoneNumber)
    .single();

  return (data?.preferred_language as SupportedLanguage) || 'en';
}

/**
 * Save customer's language preference
 */
export async function setCustomerLanguage(
  customerId: string,
  language: SupportedLanguage
): Promise<void> {
  await supabase
    .from('customer_preferences')
    .upsert({
      customer_id: customerId,
      preferred_language: language,
      updated_at: new Date(),
    });
}

/**
 * Get full language name for display
 */
export function getLanguageName(code: SupportedLanguage): string {
  const names: Record<SupportedLanguage, string> = {
    en: 'English',
    sn: 'Shona',
    nd: 'Ndebele',
  };
  return names[code];
}
