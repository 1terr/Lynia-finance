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

import { db } from '../../shared/clients/database';

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
  | 'kyc_id_number'
  | 'kyc_selfie'
  | 'kyc_verified'
  | 'kyc_failed'
  | 'kyc_processing'
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
  | 'service_not_available'
  | 'invalid_phone'
  | 'scoring_unavailable'
  | 'name_format_error'
  | 'dob_format_error'
  | 'smartphone_selected'
  | 'digital_credit_selected'
  | 'org_verification_prompt'
  | 'org_verified'
  | 'org_not_found'
  | 'org_not_eligible'
  | 'org_verification_error'
  | 'amount_selection_prompt'
  | 'amount_too_low'
  | 'amount_too_high'
  | 'disbursement_method_prompt'
  | 'disbursement_confirm_phone'
  | 'digital_loan_summary'
  | 'digital_terms'
  | 'digital_loan_approved'
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
    product_selection: 'What would you like to apply for?\n\n1 - Smartphone Financing 📱\n2 - Digital Credit 💰',
    kyc_id_upload: '📸 Upload your National ID photo.\n\nTips:\n✅ Place ID on flat surface\n✅ Good lighting\n✅ All text visible',
    kyc_id_number: '🪪 *Step 1: Enter your National ID number*\n\nPlease type your National ID number:\nFormat: *XX-XXXXXXX-X-XX*\nExample: *63-2345678-B-08*',
    kyc_selfie: '📸 Take a selfie.\n\nTips:\n✅ Face the camera directly\n✅ Remove sunglasses/hat\n✅ Good lighting',
    kyc_verified: '✅ *Identity Verified!*',
    kyc_failed: '❌ Verification failed. Please try again.',
    kyc_processing: '⏳ *Verifying Your Identity...*\n\nThis usually takes less than a minute.\nPlease wait while we verify your documents.',
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
    service_not_available: '❌ *Service Not Available*\n\nWe currently only serve customers with Zimbabwean phone numbers (+263).\n\nWe will notify you when we expand to your country!',
    invalid_phone: '❌ *Invalid Phone Number*\n\nPlease ensure you are messaging from a valid Zimbabwean mobile number.\n\nValid formats:\n• +263 77 123 4567\n• 0771234567',
    scoring_unavailable: 'We are experiencing a temporary issue assessing your application.\n\nPlease try again in a few minutes by replying with any message.\n\nIf this persists, contact support@lynia.finance',
    name_format_error: 'Please provide your full name (2-5 words).\n\nExample: *Tendai Mukanya Moyo*',
    dob_format_error: 'Invalid date format. Please use DD/MM/YYYY\n\nExample: *15/03/1990*',
    smartphone_selected: '📱 *Smartphone Financing Selected!*\n\nPerfect! We will assess your eligibility and show you available devices.\n\nFirst, we need to verify your identity.',
    digital_credit_selected: '💰 *Digital Credit Selected!*\n\nWe will assess your eligibility for a cash loan.\n\nFirst, let us verify your organization membership.',
    org_verification_prompt: '🪪 *Organization Verification*\n\nPlease enter your National ID number so we can verify your employment.\n\nFormat: *XX-XXXXXXX-X-XX*\nExample: *63-2345678-B-08*',
    org_verified: '✅ *Organization Verified!*\n\nOrganization: *{{org_name}}*\nTenure: {{tenure}} months\n\nNow let us verify your identity.',
    org_not_found: '❌ We could not find you in any registered organization.\n\nDigital credit requires employment verification.\n\nReply *BACK* for smartphone financing or *SUPPORT* for help.',
    org_not_eligible: '❌ Your organization *{{org_name}}* is not registered for digital credit yet.\n\nReply *BACK* for smartphone financing or *SUPPORT* for help.',
    org_verification_error: '⚠️ We could not verify your organization at this time. Please try again or contact support@lynia.finance',
    amount_selection_prompt: '💰 *How much do you need?*\n\nYou are approved for up to *${{max_amount}}*\n\nEnter the amount you would like to borrow:\n(Minimum: ${{min_amount}})',
    amount_too_low: 'The minimum loan amount is ${{min_amount}}. Please enter a higher amount.',
    amount_too_high: 'The maximum you can borrow is ${{max_amount}}. Please enter a lower amount.',
    disbursement_method_prompt: '📲 *How would you like to receive your funds?*\n\n1 - EcoCash\n2 - OneMoney\n3 - InnBucks\n\nReply with the number of your choice.',
    disbursement_confirm_phone: 'Funds will be sent to *{{phone}}*.\n\nIs this correct?\nReply *Yes* to confirm or enter a different number.',
    digital_loan_summary: '*Your Loan Summary*\n\nCash Loan: ${{amount}}\nTerm: {{term}} months\nInterest: {{rate}}% APR\n\nMonthly Payment: *${{payment}}*\nTotal Repayment: ${{total}}\n\nDoes this look good?\nReply *Yes* to accept these terms\nReply *Back* to change your selection',
    digital_terms: '*Loan Terms & Conditions*\n\nPlease review before accepting:\n\n1. Loan amount: ${{amount}} disbursed to your {{method}} account\n2. You will make {{term}} monthly payments of ${{payment}}\n3. No deposit required\n4. Monthly payments via mobile money\n5. No early repayment penalties\n6. Interest rate: {{rate}}% APR (declining balance)\n7. Missed payments affect your credit score and future borrowing\n\nDo you accept these terms?\n\nReply *I Accept* to continue',
    digital_loan_approved: '*Application Approved!* 🎉\n\nLoan Reference: *{{loan_number}}*\n\nYour cash loan of *${{amount}}* is being sent to your {{method}} account.\nYou will receive a confirmation shortly.\n\n*Your Payment Plan:*\n{{term}} monthly payments of ${{payment}}\n\nWelcome to Lynia Finance!',
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
    product_selection: 'Chii chaunoda kutenga?\n\n1 - Smartphone 📱\n2 - Mari Yekubatsira 💰',
    kyc_id_upload: '📸 Tora pikicha yeID yako.\n\nMashoko:\n✅ Isa ID pamusoro\n✅ Chiedza chakanaka\n✅ Mashoko ese anoonekaoneka',
    kyc_id_number: '🪪 *Chikamu 1: Nyora nhamba yeID yako*\n\nNdapota nyora nhamba yeNational ID yako:\nFormat: *XX-XXXXXXX-X-XX*\nMuenzaniso: *63-2345678-B-08*',
    kyc_selfie: '📸 Tora selfie yako.\n\nMashoko:\n✅ Tarisa kamera\n✅ Bvisa magirazi\n✅ Chiedza chakanaka',
    kyc_verified: '✅ *Waverifywa!*',
    kyc_failed: '❌ Verification harishande. Edza zvakare.',
    kyc_processing: '⏳ *Tiri Kuverifywa...*\n\nIzvi zvinotora nguva pfupi.\nNdapota mirira patinoverifywa.',
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
    service_not_available: '❌ *Service Haiwanikwe*\n\nPanguva ino tinobatsira vanhu vane nhamba dzeZimbabwe (+263) chete.\n\nTichakuzivisa kana tapararira kunyika yako!',
    invalid_phone: '❌ *Nhamba Yakaipa*\n\nShandisa nhamba yefoni yeZimbabwe inoshanda.\n\nFormat:\n• +263 77 123 4567\n• 0771234567',
    scoring_unavailable: 'Pane dambudziko rekanguva kadiki. Ndapota edza zvakare mushure menguva pfupi.\n\nKana zvichiramba, bata support@lynia.finance',
    name_format_error: 'Ndapota ipa zita rako rizere (mashoko 2-5).\n\nMuenzaniso: *Tendai Mukanya Moyo*',
    dob_format_error: 'Format yakaipa. Shandisa DD/MM/YYYY\n\nMuenzaniso: *15/03/1990*',
    smartphone_selected: '📱 *Smartphone Financing Yasarudzwa!*\n\nTichakuongorora kuti unogonawo here.\n\nKutanga, tinoda kuverifywa kwako.',
    digital_credit_selected: '💰 *Digital Credit Yasarudzwa!*\n\nTichaongorora kuti unogona kuwana loan yemari here.\n\nKutanga, ngatitarisei kuti unoshanda kupi.',
    org_verification_prompt: '🪪 *Kuverifywa Kwekambani*\n\nNdapota nyora nhamba yeNational ID yako kuti tiverifye basa rako.\n\nFormat: *XX-XXXXXXX-X-XX*\nMuenzaniso: *63-2345678-B-08*',
    org_verified: '✅ *Kambani Yaverifywa!*\n\nKambani: *{{org_name}}*\nNguva yebasa: {{tenure}} mwedzi\n\nIkozvino ngatitarisei ID yako.',
    org_not_found: '❌ Hatina kukuwana mukambani ipi zvayo yakanyoreswa.\n\nDigital credit inoda kuverifywa kwebasa.\n\nPindura *BACK* kuti uende kusmartphone kana *SUPPORT* kuti ubatsirwe.',
    org_not_eligible: '❌ Kambani yako *{{org_name}}* haisati yanyoreswa nedigital credit.\n\nPindura *BACK* kuti uende kusmartphone kana *SUPPORT* kuti ubatsirwe.',
    org_verification_error: '⚠️ Hatina kugona kuverifya kambani yako panguva ino. Ndapota edza zvakare kana utaure nesupport@lynia.finance',
    amount_selection_prompt: '💰 *Mari ingani yaunoda?*\n\nWabvumirwa kusvika *${{max_amount}}*\n\nNyora mari yaunoda kuborrower:\n(Yakaderera: ${{min_amount}})',
    amount_too_low: 'Mari yakaderera ndeiyi ${{min_amount}}. Ndapota nyora mari yakawanda.',
    amount_too_high: 'Mari yakawandisa yaunogona kuborrower ndeyi ${{max_amount}}. Ndapota nyora mari shoma.',
    disbursement_method_prompt: '📲 *Unoda kugamuchira mari yako sei?*\n\n1 - EcoCash\n2 - OneMoney\n3 - InnBucks\n\nPindura nenhamba yako.',
    disbursement_confirm_phone: 'Mari ichatumirwa ku *{{phone}}*.\n\nIzvi zvakarurama here?\nPindura *Hongu* kuti usimbise kana unyore nhamba yakasiyana.',
    digital_loan_summary: '*Pfupiso yeLoan Yako*\n\nMari yeLoan: ${{amount}}\nNguva: {{term}} mwedzi\nInterest: {{rate}}% APR\n\nPayment yemwedzi: *${{payment}}*\nYose: ${{total}}\n\nZvakanaka here?\nPindura *Hongu* kuti ubvume\nPindura *Back* kuti uchinje',
    digital_terms: '*Mitemo yeLoan*\n\nNdapota verenga usati wabvuma:\n\n1. Mari ye${{amount}} ichatumirwa ku{{method}} yako\n2. Uchabhadhara {{term}} payments dze${{payment}}\n3. Hapana deposit inodiwa\n4. Mabhadhariro emwedzi nemobile money\n5. Hapana mutengo wekubhadhara munguva pfupi\n6. Interest rate: {{rate}}% APR\n7. Kusabhadhara kunobata credit score yako\n\nUnobvuma mitemo here?\n\nPindura *Ndinobvuma* kuti upfuurire',
    digital_loan_approved: '*Wabvumirwa!* 🎉\n\nLoan Reference: *{{loan_number}}*\n\nMari yako ye *${{amount}}* iri kutumirwa ku{{method}} yako.\nUchagamuchira confirmation munguva pfupi.\n\n*Payment Plan Yako:*\n{{term}} payments dze${{payment}} pamwedzi\n\nMauya kuLynia Finance!',
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
    product_selection: 'Ufuna ukuthengani?\n\n1 - I-Smartphone 📱\n2 - Imali Yokusiza 💰',
    kyc_id_upload: '📸 Thatha isithombe se-ID yakho.\n\nAmacebo:\n✅ Beka i-ID phansi\n✅ Ukukhanya okuhle\n✅ Wonke amagama abonakale',
    kyc_id_number: '🪪 *Isinyathelo 1: Bhala inombolo ye-ID yakho*\n\nBhala inombolo ye-National ID yakho:\nI-format: *XX-XXXXXXX-X-XX*\nIsibonelo: *63-2345678-B-08*',
    kyc_selfie: '📸 Thatha i-selfie yakho.\n\nAmacebo:\n✅ Khangela ikhamera\n✅ Susa izibuko zelanga\n✅ Ukukhanya okuhle',
    kyc_verified: '✅ *Uqinisekisiwe!*',
    kyc_failed: '❌ Ukuqinisekisa akuphumelelanga. Zama futhi.',
    kyc_processing: '⏳ *Siyaqinisekisa...*\n\nLokhu kuthatha isikhathi esifitshane.\nSicela ulinde siqinisekisa amaphepha akho.',
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
    service_not_available: '❌ *I-Service Ayithokalali*\n\nOkwamanje sisebenzela abathengi abanezinombolo zeZimbabwe (+263) kuphela.\n\nSizakwazisa nxa sesandisa!',
    invalid_phone: '❌ *Inombolo Engalunganga*\n\nSicela usebenzise inombolo ye-Zimbabwe efaneleyo.\n\nI-format:\n• +263 77 123 4567\n• 0771234567',
    scoring_unavailable: 'Kulenkinga yesikhashana. Sicela uzame futhi ngemuva kwesikhathi esifitshane.\n\nNxa kuqhubeka, thinta support@lynia.finance',
    name_format_error: 'Sicela unikeze ibizo lakho eligcweleyo (amagama angu 2-5).\n\nIsibonelo: *Tendai Mukanya Moyo*',
    dob_format_error: 'I-format engalunganga. Sebenzisa DD/MM/YYYY\n\nIsibonelo: *15/03/1990*',
    smartphone_selected: '📱 *I-Smartphone Financing Ikhethiwe!*\n\nSizahlola ukufaneleka kwakho.\n\nKuqala, sidinga ukuqinisekisa ubuwena.',
    digital_credit_selected: '💰 *I-Digital Credit Ikhethiwe!*\n\nSizahlola ukufaneleka kwakho kwe-loan yemali.\n\nKuqala, ake sihlole umsebenzi wakho.',
    org_verification_prompt: '🪪 *Ukuqinisekisa Inkampani*\n\nSicela ubhale inombolo ye-National ID yakho ukuze siqinisekise umsebenzi wakho.\n\nI-format: *XX-XXXXXXX-X-XX*\nIsibonelo: *63-2345678-B-08*',
    org_verified: '✅ *Inkampani Iqinisekisiwe!*\n\nInkampani: *{{org_name}}*\nIsikhathi somsebenzi: {{tenure}} izinyanga\n\nKhathesi ake siqinisekise ubuwena.',
    org_not_found: '❌ Asikutholanga enkampanini ebhalisiweyo.\n\nI-digital credit idinga ukuqinisekiswa komsebenzi.\n\nPhendula *BACK* ukuya ku-smartphone kumbe *SUPPORT* ukuthola usizo.',
    org_not_eligible: '❌ Inkampani yakho *{{org_name}}* ayikabhalisi kwe-digital credit.\n\nPhendula *BACK* ukuya ku-smartphone kumbe *SUPPORT* ukuthola usizo.',
    org_verification_error: '⚠️ Asikwazanga ukuqinisekisa inkampani yakho okwamanje. Sicela uzame futhi kumbe uthinte support@lynia.finance',
    amount_selection_prompt: '💰 *Imali engakanani oyidingayo?*\n\nUvunyelwe kuze kufike *${{max_amount}}*\n\nBhala imali ofuna ukuyiboleka:\n(Okuncinyane: ${{min_amount}})',
    amount_too_low: 'Imali encinyane ngu-${{min_amount}}. Sicela ubhale imali enkulu.',
    amount_too_high: 'Imali enkulu ongayiboleka ngu-${{max_amount}}. Sicela ubhale imali encinyane.',
    disbursement_method_prompt: '📲 *Ufuna ukuthola imali yakho njani?*\n\n1 - EcoCash\n2 - OneMoney\n3 - InnBucks\n\nPhendula ngenombolo yakho.',
    disbursement_confirm_phone: 'Imali izathunyelwa ku-*{{phone}}*.\n\nLokhu kulungile?\nPhendula *Yebo* ukuqinisekisa kumbe ubhale inombolo ehlukileyo.',
    digital_loan_summary: '*Isifinyezo Se-Loan Yakho*\n\nI-Loan Yemali: ${{amount}}\nIsikhathi: {{term}} izinyanga\nInterest: {{rate}}% APR\n\nI-payment yenyanga: *${{payment}}*\nYonke: ${{total}}\n\nKulungile?\nPhendula *Yebo* ukuvuma\nPhendula *Back* ukuguqula',
    digital_terms: '*Imithetho Ye-Loan*\n\nSicela ufunde ungakavumi:\n\n1. Imali ye-${{amount}} izathunyelwa ku-{{method}} yakho\n2. Uzabhadala {{term}} ama-payment e-${{payment}}\n3. Akukho deposit edingekayo\n4. Ukubhadala kwenyanga nge-mobile money\n5. Akukho inhlawulo yokubhadala kusenesikhathi\n6. Interest rate: {{rate}}% APR\n7. Ukungabhadali kuthinta i-credit score yakho\n\nUyavuma imithetho?\n\nPhendula *Ngiyavuma* ukuqhubeka',
    digital_loan_approved: '*Uvunyelwe!* 🎉\n\nLoan Reference: *{{loan_number}}*\n\nI-loan yakho ye-*${{amount}}* ithunyelwa ku-{{method}} yakho.\nUzathola i-confirmation masinyane.\n\n*I-Payment Plan Yakho:*\n{{term}} ama-payment e-${{payment}} ngenyanga\n\nSiyalemukela kuLynia Finance!',
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
  const { data } = await db
    .from('customer_preferences')
    .select('preferred_language, customers!inner(phone_number)')
    .eq('customers.phone_number', phoneNumber)
    .single()
    .execute();

  return (data?.preferred_language as SupportedLanguage) || 'en';
}

/**
 * Save customer's language preference
 */
export async function setCustomerLanguage(
  customerId: string,
  language: SupportedLanguage
): Promise<void> {
  await db
    .from('customer_preferences')
    .upsert({
      customer_id: customerId,
      preferred_language: language,
      updated_at: new Date(),
    })
    .execute();
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
