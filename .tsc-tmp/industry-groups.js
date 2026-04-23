/**
 * LinkedIn's granular industry taxonomy is too fine-grained for a useful
 * dropdown filter, so we group related industries into a handful of buckets.
 * The mapping is industry-level (Option A): a few edge-case people will land
 * in their industry's majority bucket even if their actual company fits a
 * different one — accepted tradeoff for simplicity.
 */
export const INDUSTRY_GROUPS = [
    "Tech & Hardware",
    "Finance & Investing",
    "Consulting",
    "Education",
    "Non-Profit & Social Impact",
    "Research & Science",
    "Healthcare",
    "Other",
];
export const INDUSTRY_TO_GROUP = {
    // Tech & Hardware
    "Software Development": "Tech & Hardware",
    "Technology, Information and Internet": "Tech & Hardware",
    "Technology, Information and Media": "Tech & Hardware",
    "IT Services and IT Consulting": "Tech & Hardware",
    "Information Technology & Services": "Tech & Hardware",
    "Information Services": "Tech & Hardware",
    "Computers and Electronics Manufacturing": "Tech & Hardware",
    "Computer Hardware Manufacturing": "Tech & Hardware",
    "Computer and Network Security": "Tech & Hardware",
    "Semiconductor Manufacturing": "Tech & Hardware",
    "Renewable Energy Semiconductor Manufacturing": "Tech & Hardware",
    "Appliances, Electrical, and Electronics Manufacturing": "Tech & Hardware",
    "Automation Machinery Manufacturing": "Tech & Hardware",
    "Robotics Engineering": "Tech & Hardware",
    "Motor Vehicle Manufacturing": "Tech & Hardware",
    "Internet Marketplace Platforms": "Tech & Hardware",
    "Business Intelligence Platforms": "Tech & Hardware",
    "Advertising Services": "Tech & Hardware",
    "Marketing Services": "Tech & Hardware",
    "Media Production": "Tech & Hardware",
    "Broadcast Media Production and Distribution": "Tech & Hardware",
    "Graphic Design": "Tech & Hardware",
    "Professional Services": "Tech & Hardware",
    // Finance & Investing
    "Financial Services": "Finance & Investing",
    "Venture Capital and Private Equity Principals": "Finance & Investing",
    "Investment Management": "Finance & Investing",
    "Banking": "Finance & Investing",
    "Insurance": "Finance & Investing",
    "Accounting": "Finance & Investing",
    "Real Estate": "Finance & Investing",
    // Consulting
    "Business Consulting and Services": "Consulting",
    // Education
    "Higher Education": "Education",
    "Education Administration Programs": "Education",
    "Primary and Secondary Education": "Education",
    "Education": "Education",
    "E-Learning Providers": "Education",
    "E-learning": "Education",
    "Professional Training and Coaching": "Education",
    // Non-Profit & Social Impact
    "Non-profit Organizations": "Non-Profit & Social Impact",
    "Non-profit Organization Management": "Non-Profit & Social Impact",
    "Civic and Social Organizations": "Non-Profit & Social Impact",
    "International Affairs": "Non-Profit & Social Impact",
    "International Trade and Development": "Non-Profit & Social Impact",
    "Public Health": "Non-Profit & Social Impact",
    "Public Policy": "Non-Profit & Social Impact",
    // Research & Science
    "Research Services": "Research & Science",
    "Biotechnology Research": "Research & Science",
    "Research": "Research & Science",
    // Healthcare
    "Hospitals and Health Care": "Healthcare",
    "Medical Equipment Manufacturing": "Healthcare",
    "Pharmaceutical Manufacturing": "Healthcare",
    "Health and Human Services": "Healthcare",
    // Other (truly miscellaneous — not assigned to a named bucket)
    "Government Administration": "Other",
    "Retail": "Other",
    "Entertainment Providers": "Other",
    "Environmental Services": "Other",
    "Utilities": "Other",
    "Civil Engineering": "Other",
    "Events Services": "Other",
    "Fire Protection": "Other",
    "Food and Beverage Manufacturing": "Other",
    "Food and Beverage Services": "Other",
    "Ground Passenger Transportation": "Other",
    "Law Practice": "Other",
    "Mining": "Other",
    "Museums, Historical Sites, and Zoos": "Other",
    "Theater Companies": "Other",
};
/**
 * List of LinkedIn industries that map to a given group. Used to expand a
 * group filter into an industry ANY-match in the WHERE clause.
 */
export function industriesInGroup(group) {
    return Object.entries(INDUSTRY_TO_GROUP)
        .filter(([, g]) => g === group)
        .map(([ind]) => ind);
}
export function groupForIndustry(industry) {
    if (!industry)
        return "Other";
    return INDUSTRY_TO_GROUP[industry] ?? "Other";
}
