// TODO(launch): Replace static editorial content with real articles or connect Sanity CMS

export type Category = 'Company' | 'Market' | 'Products' | 'Engineering' | 'Investment Thesis' | 'Technology';

export interface Author {
  name: string;
  role: string;
}

export interface Post {
  slug: string;
  category: Category;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  author: Author;
  body: string[];
}

const team = {
  founders: { name: 'Lynia Finance Team', role: 'Founding Team' },
  product: { name: 'Lynia Finance Team', role: 'Product' },
  engineering: { name: 'Lynia Finance Team', role: 'Engineering' },
};

export const categories: Category[] = ['Company', 'Market', 'Products', 'Engineering', 'Investment Thesis', 'Technology'];

export const posts: Post[] = [
  {
    slug: 'payment-infrastructure-margin-expansion',
    category: 'Investment Thesis',
    title: 'Payment Infrastructure: Margin Expansion Through Rails Substitution',
    excerpt: '$100B in direct fees. $50B addressable. A one-time infrastructure upgrade with permanent margin improvement.',
    date: '28 Feb 2026',
    readTime: '20 min read',
    author: team.founders,
    body: [
      'Africa\u2019s payment infrastructure was built for a different era. The rails that move money between mobile wallets, banks, and merchants were designed when transaction volumes were a fraction of what they are today. The result is a system where fees consume 2\u20134% of every transaction \u2014 a tax on economic activity that falls hardest on those who can least afford it.',
      'The numbers are staggering. Sub-Saharan Africa processes over $100 billion in digital payment fees annually. Of that, roughly $50 billion is addressable through infrastructure modernisation \u2014 replacing legacy switching layers, reducing settlement times, and eliminating redundant intermediaries.',
      'This is not a technology problem. The protocols exist. Real-time gross settlement systems, ISO 20022 messaging, and blockchain-based clearing are all production-ready. The barrier is distribution: who has the customer relationships, the regulatory licences, and the local trust to swap out the rails without disrupting the flow?',
      'Lynia\u2019s thesis is that the companies best positioned to execute this substitution are those already embedded in the transaction flow. Asset financiers, credit providers, and mobile money agents who process thousands of transactions daily have a natural insertion point. Every loan disbursement, every repayment, every device payment is an opportunity to route through lower-cost infrastructure.',
      'The margin improvement is permanent. Unlike revenue growth that requires continuous customer acquisition, infrastructure substitution is a one-time upgrade that reduces cost-per-transaction for the life of the system. A lender processing $10M in monthly disbursements who reduces payment costs from 3% to 0.8% adds $264K in annual margin \u2014 without acquiring a single new customer.',
      'We are building this infrastructure layer into Lynia\u2019s core platform. Every mobile money integration, every agent settlement, every customer repayment is designed to operate on the lowest-cost rail available. As we scale across Zimbabwe and beyond, the compounding effect of basis-point savings becomes a structural advantage.',
      'The opportunity window is narrow. As mobile money volumes grow 30%+ annually across the continent, the incumbents who control the current rails are investing in their own modernisation. The next three years will determine whether the margin improvement accrues to fintechs who build their own infrastructure or to the existing players who upgrade theirs.',
      'We believe the advantage goes to the builders. Not because the technology is hard, but because the distribution is. And distribution is what we do.',
    ],
  },
  {
    slug: 'infrastructure-repricing',
    category: 'Technology',
    title: 'The Infrastructure Repricing',
    excerpt: 'AI is forcing SaaS to evolve. The companies that modernize their payment infrastructure will re-rate. The rest won\u2019t survive the transition.',
    date: '20 Feb 2026',
    readTime: '15 min read',
    author: team.engineering,
    body: [
      'Every decade, a technological shift forces a repricing of infrastructure. The move from on-premise to cloud repriced compute. The move from batch to real-time repriced data. Now, the integration of AI into financial services is repricing the entire credit and payments stack.',
      'The repricing is not about AI replacing humans. It\u2019s about AI making previously uneconomical customer segments profitable. When the cost of underwriting a $50 loan drops from $15 to $0.30, the unit economics of serving the informal economy flip from impossible to attractive.',
      'Traditional SaaS platforms in African fintech were built for a world where the cost of serving each customer was high enough to justify $5\u201310 monthly subscriptions or 1\u20132% transaction fees. AI-driven automation is collapsing these costs. The platforms that don\u2019t adapt will find their margins competed away by leaner infrastructure.',
      'At Lynia, we\u2019re seeing this repricing in real-time. Our AI-powered credit scoring processes applications in under 5 minutes \u2014 a task that would take a human analyst 2\u20133 hours. Our WhatsApp automation handles 80% of customer interactions without human intervention. Each automation compounds: lower cost per customer means we can profitably serve smaller loan sizes, which expands our addressable market.',
      'The companies that will re-rate \u2014 that will see their valuations increase as the market recognises their structural advantages \u2014 are those modernising their infrastructure now. This means replacing batch processing with real-time decisioning, replacing manual review with AI-assisted workflows, and replacing high-cost payment rails with direct integrations.',
      'The rest face a slow compression. Their margins shrink as competitors automate. Their customer acquisition costs rise as the market fragments. Their infrastructure becomes a liability rather than an asset.',
      'We are building Lynia\u2019s infrastructure for the post-repricing world. Every system we deploy is designed to operate at 10x the volume and one-tenth the cost of traditional alternatives. That\u2019s not an aspiration \u2014 it\u2019s a requirement for serving the market we\u2019re targeting.',
    ],
  },
  {
    slug: 'onchain-credit-flywheel',
    category: 'Investment Thesis',
    title: 'The Onchain Credit Flywheel',
    excerpt: 'How originators can grow both supply and demand for quality loans. $19B+ originated, 93% cost reduction, ~200bps investor yield advantage.',
    date: '14 Feb 2026',
    readTime: '14 min read',
    author: team.founders,
    body: [
      'Credit markets in Africa are structurally broken. On one side, hundreds of millions of creditworthy borrowers cannot access affordable loans. On the other, institutional investors seeking yield cannot find quality origination at scale. The gap between supply and demand is not a market failure \u2014 it\u2019s an infrastructure failure.',
      'The onchain credit flywheel solves both sides simultaneously. By recording loan origination, performance, and repayment data on transparent, auditable infrastructure, originators create a feedback loop that attracts capital, improves underwriting, and expands access.',
      'The mechanics are straightforward. An originator like Lynia issues loans and records performance data. This data \u2014 default rates, recovery rates, portfolio seasoning \u2014 becomes verifiable by any investor. As the data proves quality, more capital flows in. More capital means more loans. More loans mean more data. The flywheel accelerates.',
      'The numbers from early adopters are compelling. Over $19 billion has been originated through onchain credit protocols globally. Originators report 93% cost reduction in capital raising compared to traditional securitisation. Investors see approximately 200 basis points of yield advantage over comparable traditional credit products.',
      'For Lynia, this model transforms our capital structure. Instead of relying on a single bank facility or development finance institution, we can access a global pool of credit investors who evaluate our portfolio on performance, not relationships. Our mobile money repayment data \u2014 timestamped, immutable, and auditable \u2014 is exactly the kind of transparent collateral that onchain capital markets are designed for.',
      'The flywheel also disciplines origination. When every loan is visible, originators cannot hide poor underwriting behind opaque reporting. The market rewards quality and punishes recklessness in real-time. This alignment of incentives is what makes the model sustainable.',
      'We are building toward this architecture. Our scoring models, repayment tracking, and portfolio analytics are designed to produce the data transparency that institutional capital requires. When we connect to onchain capital markets, the integration will be seamless because the infrastructure was built for it from day one.',
      'The onchain credit flywheel is not a future possibility. It\u2019s happening now. The originators who build for it today will have a structural advantage in accessing the lowest-cost capital for the next decade.',
    ],
  },
  {
    slug: 'why-we-built-lynia-finance',
    category: 'Company',
    title: 'Why we built Lynia Finance',
    excerpt: 'The story behind our mission to serve Zimbabwe\u2019s underbanked majority.',
    date: '10 Feb 2026',
    readTime: '5 min read',
    author: team.founders,
    body: [
      'In Zimbabwe, 80% of the working population operates in the informal economy. They earn a living, support families, and run small businesses. But when they need credit \u2014 to buy a smartphone for their trade, to cover an emergency, to invest in stock \u2014 the answer from traditional banks is almost always no.',
      'We started Lynia Finance because we believe access to credit should not depend on having a bank account, a formal employer, or a credit history that only 5% of the population can build.',
      'The gap is enormous. Zimbabwe has an estimated $14 billion in unserved credit demand. Mobile money adoption exceeds 70%. The infrastructure for digital financial services already exists \u2014 what\u2019s missing are products designed for the people who actually need them.',
      'Traditional banks require collateral, payslips, and months of paperwork. Microfinance institutions charge prohibitive rates. Neither model works for the market vendor who earns in cash, the farmer who gets paid seasonally, or the young entrepreneur starting from zero.',
      'Lynia takes a different approach. We deliver financial products through WhatsApp \u2014 the app people already use every day. We assess creditworthiness using mobile money transaction data instead of bank statements. We distribute devices through a network of local agents instead of bank branches.',
      'Our first product is asset financing: smartphones and productive assets with a small deposit, collected from a local agent, repaid via mobile money. It\u2019s simple by design. Apply in under 2 minutes. Get approved in under 5. Pick up your device the same day.',
      'We\u2019re building for Zimbabwe first, but the problem we\u2019re solving exists across the continent. Over 350 million adults in Sub-Saharan Africa lack access to formal credit. The tools we build here will scale.',
      'Every feature we ship, every line of code we write, serves real people trying to build better lives. That\u2019s why we built Lynia Finance.',
    ],
  },
  {
    slug: 'zimbabwe-14b-credit-gap',
    category: 'Market',
    title: 'Zimbabwe\u2019s $14B credit gap',
    excerpt: '80% of the workforce is informal. Less than 5% have bank credit. Here\u2019s how we\u2019re closing the gap.',
    date: '8 Feb 2026',
    readTime: '6 min read',
    author: team.founders,
    body: [
      'Zimbabwe\u2019s economy runs on informal work. Market traders, cross-border merchants, small-scale farmers, and independent service providers make up roughly 80% of the workforce. They contribute significantly to GDP, yet less than 5% of informal workers have access to bank credit.',
      'The numbers tell a stark story. Zimbabwe has an estimated $14 billion in unserved credit demand. Traditional financial institutions serve a narrow slice of the population \u2014 salaried employees with bank accounts, formal employment records, and collateral. Everyone else is left out.',
      'This isn\u2019t a failure of demand. It\u2019s a failure of supply. The informal workforce has real, productive credit needs: financing tools for their trade, bridging cash flow gaps, investing in inventory. What they lack are products designed for how they actually earn and spend.',
      'Mobile money changed the payments landscape in Zimbabwe. Over 70% of adults use EcoCash, OneMoney, or Innbucks for daily transactions. This created a rich data layer \u2014 transaction histories that reveal earning patterns, spending habits, and financial behaviour that traditional credit scores can\u2019t capture.',
      'At Lynia, we\u2019re building on this existing infrastructure. Instead of requiring bank statements, we use mobile money data to assess creditworthiness. Instead of bank branches, we use a network of local agents. Instead of complex applications, we use WhatsApp.',
      'The opportunity is massive, not just in Zimbabwe but across Sub-Saharan Africa where similar dynamics exist. Over 350 million adults lack access to formal credit. Mobile money is growing faster than banking. The combination creates the conditions for a new kind of financial institution \u2014 one built for the majority, not the minority.',
      'Closing the credit gap isn\u2019t just good business. It\u2019s how economies unlock growth. When a trader can finance a smartphone, they can accept mobile payments and expand their customer base. When a farmer can access working capital, they can invest in better inputs and increase yields. Credit is a multiplier.',
      'We\u2019re starting with asset financing and digital credit in Zimbabwe. The infrastructure we\u2019re building \u2014 the scoring models, the distribution network, the mobile money integrations \u2014 is designed to scale across markets.',
    ],
  },
  {
    slug: 'how-asset-financing-works',
    category: 'Products',
    title: 'How asset financing works',
    excerpt: 'From deposit to device in under 24 hours. A step-by-step walkthrough.',
    date: '5 Feb 2026',
    readTime: '4 min read',
    author: team.product,
    body: [
      'Asset financing is Lynia\u2019s flagship product. It lets customers finance smartphones and productive assets with a small deposit, collect from a local agent, and repay via mobile money. Here\u2019s exactly how it works.',
      'Step 1: Apply via WhatsApp. Send a message to our WhatsApp number. Tell us what device you need. The entire application takes under 2 minutes \u2014 no forms to fill, no branch to visit, no app to download.',
      'Step 2: Get verified. Our system checks your identity using your national ID and verifies your eligibility using mobile money transaction data. This happens in under 5 minutes. No payslips required. No bank statements. No collateral.',
      'Step 3: Pay your deposit. Once approved, you pay a small deposit via EcoCash, OneMoney, or Innbucks. Deposits start as low as $15 depending on the device. The deposit confirms your commitment and secures your device.',
      'Step 4: Collect your device. Pick up your smartphone from a Lynia agent in your area. We have over 50 agent locations across Zimbabwe and growing. Your agent will help you set up the device and explain the repayment schedule.',
      'Step 5: Repay via mobile money. Make regular payments through the mobile money wallet you already use. Payments are flexible \u2014 weekly or monthly depending on your preference. You can pay early with no penalty.',
      'The device is yours from day one. You use it, you earn with it, you grow with it. If payments are missed, the device may be temporarily locked until the account is current \u2014 but emergency calls are always available.',
      'That\u2019s it. No bank account needed. No paperwork. No waiting weeks for approval. Asset financing that works the way Zimbabwe works.',
    ],
  },
  {
    slug: 'building-credit-scoring-informal-economy',
    category: 'Engineering',
    title: 'Building credit scoring for the informal economy',
    excerpt: 'No payslips. No bank statements. How we assess creditworthiness using mobile money data.',
    date: '1 Feb 2026',
    readTime: '7 min read',
    author: team.engineering,
    body: [
      'Traditional credit scoring doesn\u2019t work for 80% of Zimbabwe\u2019s workforce. No bank statements. No payslips. No formal employment records. So how do you assess whether someone is creditworthy?',
      'At Lynia, we built a scoring system designed for the informal economy. Instead of relying on data that most people don\u2019t have, we use data they do: mobile money transactions.',
      'Mobile money is everywhere in Zimbabwe. Over 70% of the adult population uses services like EcoCash, OneMoney, or Innbucks for daily transactions. Every top-up, every payment, every transfer creates a data point. Together, these paint a picture of financial behaviour.',
      'Our scoring model looks at several dimensions. Transaction frequency tells us about economic activity. Consistency of incoming transfers suggests income stability. Spending patterns reveal financial discipline. Peer-to-peer transfer networks indicate social capital and community ties.',
      'We don\u2019t use a single score. Our system produces a risk profile that considers multiple factors: the amount requested, the repayment period, the customer\u2019s transaction history, and the specific product. A customer who is low-risk for a $50 device might be higher-risk for a $500 one.',
      'The engineering challenge is significant. Mobile money data is noisy. Transactions don\u2019t come with labels. A $20 incoming transfer could be salary, a loan repayment from a friend, or a sale. We use pattern recognition to distinguish between these, building features that capture the underlying economic reality.',
      'Privacy is built into the system from the ground up. We collect only the data necessary for the credit decision. All data is encrypted at rest and in transit. Customers consent explicitly to data collection and can request deletion. We comply with all Reserve Bank of Zimbabwe data protection requirements.',
      'Our first models were simple \u2014 rule-based systems that looked at a handful of features. As we collect more repayment data, we\u2019re training more sophisticated models that improve accuracy and reduce default rates. The goal is a virtuous cycle: better scoring leads to more approvals, more repayment data, and even better scoring.',
      'Building credit infrastructure for the informal economy is one of the most impactful engineering problems in African fintech. We\u2019re just getting started.',
    ],
  },
  {
    slug: 'our-distributor-network',
    category: 'Company',
    title: 'Our distributor network',
    excerpt: 'How local agents across Zimbabwe are helping communities access financing.',
    date: '28 Jan 2026',
    readTime: '4 min read',
    author: team.founders,
    body: [
      'Lynia Finance doesn\u2019t operate from bank branches. We operate through a growing network of local agents \u2014 phone shops, general dealers, and community leaders who serve as the physical layer of our digital platform.',
      'Our distributor network is central to how asset financing works. When a customer is approved for a device, they don\u2019t wait for delivery. They walk to a nearby agent, verify their identity, and walk out with their smartphone the same day.',
      'We chose this model deliberately. In Zimbabwe, trust is local. People buy from people they know. A phone shop owner in Mbare or a general dealer in Chitungwiza has relationships with their community that no app can replicate.',
      'For distributors, the model is straightforward. They carry Lynia-financed inventory at zero risk \u2014 we own the stock until the customer completes payment. Distributors earn commission on every sale. They don\u2019t need to extend credit themselves or manage repayments.',
      'We provide training, marketing materials, and a dedicated support line. Each distributor gets access to a dashboard showing their sales, commissions, and customer pipeline. The tools are simple because they need to be \u2014 many of our agents use the same low-end smartphones our customers are financing.',
      'Today we have over 50 agent locations across Zimbabwe, concentrated in Harare and major towns. Our goal is to reach every district. The network scales organically \u2014 as existing agents prove the model, new ones join.',
      'If you run a phone shop, a general dealership, or any business with foot traffic and a customer base, you can become a Lynia distributor. No upfront investment. No inventory risk. Just a new revenue stream from helping your community access financing.',
    ],
  },
  {
    slug: 'mobile-money-repayments-explained',
    category: 'Products',
    title: 'Mobile money repayments explained',
    excerpt: 'A simple guide to repaying your loan through EcoCash, OneMoney, or Innbucks.',
    date: '25 Jan 2026',
    readTime: '3 min read',
    author: team.product,
    body: [
      'Repaying your Lynia Finance loan is designed to be as simple as sending money to a friend. Everything happens through the mobile money wallet you already use.',
      'We support three mobile money providers: EcoCash (Econet), OneMoney (NetOne), and Innbucks. You choose which wallet to use when you set up your repayment schedule. You can switch providers at any time.',
      'When you\u2019re approved for a loan, you\u2019ll receive a clear repayment schedule via WhatsApp. This shows every payment date, the amount due, and the total remaining balance. No surprises, no hidden fees.',
      'Making a payment is straightforward. You\u2019ll receive a WhatsApp reminder before each due date with a simple payment link. Tap the link, confirm the amount in your mobile money app, and you\u2019re done. The whole process takes under a minute.',
      'You can also pay ahead of schedule. There\u2019s no penalty for early repayment. If you have extra funds, you can make a partial or full early payment at any time. This reduces your remaining balance and can shorten your repayment period.',
      'If you\u2019re having difficulty making a payment, reach out before the due date. We offer extensions and restructuring for customers facing genuine hardship. Our goal is to help you succeed, not to penalise you.',
      'Every payment is confirmed instantly via WhatsApp. You\u2019ll receive a receipt showing the amount paid, the date, and your updated balance. You can check your full payment history at any time by messaging us on WhatsApp.',
      'For asset financing customers: your device stays fully functional throughout the repayment period. If payments fall significantly behind, the device may be temporarily restricted until the account is current \u2014 but emergency calls always remain available.',
    ],
  },
];

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug);
}

export function getRelatedPosts(currentSlug: string, limit = 3): Post[] {
  const current = getPostBySlug(currentSlug);
  if (!current) return posts.slice(0, limit);

  const sameCategory = posts.filter(
    (p) => p.slug !== currentSlug && p.category === current.category
  );
  const others = posts.filter(
    (p) => p.slug !== currentSlug && p.category !== current.category
  );

  return [...sameCategory, ...others].slice(0, limit);
}
