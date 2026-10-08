export const VERIFIED_ON = "2026-08-06";

export type FundingLevel =
  | "Fully funded"
  | "Major funded"
  | "Programme dependent"
  | "Not verified";

export type FitLevel =
  | "Strong Target"
  | "Good Target"
  | "Reach"
  | "Currently Ineligible"
  | "Pending Review";

export type TrackerStatus =
  | "OPEN"
  | "PREPARING"
  | "WATCHING"
  | "URGENT"
  | "SUBMITTED"
  | "RESULT PENDING"
  | "SELECTED"
  | "CLOSED";

export type Scholarship = {
  id: string;
  name: string;
  shortName: string;
  country: string;
  universities: string;
  programme: string;
  areas: string[];
  areaLabel: string;
  fundingLevel: FundingLevel;
  fundingCovers: string;
  bangladeshEligibility: string;
  academicRequirements: string;
  englishRequirements: string;
  workExperience: string;
  finalYearStudents: string;
  intakes: string[];
  opens: string | null;
  deadline: string | null;
  dateNote: string;
  officialNoticeUrl: string;
  applyUrl: string;
  lastVerified: string;
  baseStatus: TrackerStatus;
  fit: FitLevel;
  fitReason: string;
  nextAction: string;
  notes: string;
  sourceTag: string;
};

export const scholarships: Scholarship[] = [
  {
    id: "commonwealth-masters",
    name: "Commonwealth Master’s Scholarship",
    shortName: "Commonwealth Master’s",
    country: "United Kingdom",
    universities: "Approved UK universities",
    programme: "One-year taught Master’s in an eligible development-related subject",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity"],
    areaLabel: "CSE / AI / Data",
    fundingLevel: "Fully funded",
    fundingCovers:
      "Approved return airfare, full tuition, monthly stipend (£1,452 or £1,781 in London for 2026/27), warm-clothing and study-travel grants, plus eligible family/disability support.",
    bangladeshEligibility:
      "Yes. Bangladesh is an eligible Commonwealth country; applicants must use an approved nominating agency route.",
    academicRequirements:
      "Normally a first degree equivalent to at least a UK upper-second-class (2:1), or a lower-second-class degree plus a relevant postgraduate qualification.",
    englishRequirements:
      "CSC does not set one universal IELTS score; the selected university’s admission requirement applies.",
    workExperience: "No general work-experience requirement in the CSC rules.",
    finalYearStudents:
      "The bachelor’s degree must be held by the programme’s stated September cut-off; apply only if final completion documents will be available in time.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote: "The 2027/28 cycle has not been announced yet.",
    officialNoticeUrl:
      "https://cscuk.fcdo.gov.uk/scholarships/commonwealth-masters-scholarships/",
    applyUrl: "https://cscuk.fcdo.gov.uk/apply/",
    lastVerified: VERIFIED_ON,
    baseStatus: "WATCHING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "CSC",
  },
  {
    id: "commonwealth-shared",
    name: "Commonwealth Shared Scholarships",
    shortName: "Commonwealth Shared",
    country: "United Kingdom",
    universities: "Participating UK universities and approved courses",
    programme: "Selected taught Master’s courses linked to sustainable development",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity"],
    areaLabel: "Selected CSE courses",
    fundingLevel: "Fully funded",
    fundingCovers:
      "Full tuition, approved airfare, monthly stipend (£1,452 or £1,781 in London for 2026/27), warm-clothing and study-travel grants, plus eligible family/disability support.",
    bangladeshEligibility:
      "Yes, subject to the eligible-country list and admission to a course participating in that year’s Shared Scholarship scheme.",
    academicRequirements:
      "Normally at least a UK 2:1 equivalent, or a 2:2 plus a relevant postgraduate qualification; applicants must demonstrate that they could not otherwise afford UK study.",
    englishRequirements:
      "No single CSC IELTS threshold; the participating university and course set the English standard.",
    workExperience: "No general work-experience requirement in the CSC rules.",
    finalYearStudents:
      "Degree completion is required by the CSC September cut-off; confirm the exact year-specific wording when the call appears.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote: "The 2027/28 call and eligible-course list are not announced yet.",
    officialNoticeUrl:
      "https://cscuk.fcdo.gov.uk/scholarships/commonwealth-shared-scholarships-applications/",
    applyUrl:
      "https://cscuk.fcdo.gov.uk/commonwealth-shared-scholarships-eligible-courses/",
    lastVerified: VERIFIED_ON,
    baseStatus: "WATCHING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "CSC",
  },
  {
    id: "erasmus-mundus",
    name: "Erasmus Mundus Joint Masters",
    shortName: "Erasmus Mundus",
    country: "European consortium",
    universities: "Multiple universities across at least two countries",
    programme: "Catalogue of joint Master’s programmes; each consortium sets its own requirements",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity"],
    areaLabel: "CSE / STEM catalogue",
    fundingLevel: "Fully funded",
    fundingCovers:
      "Top-ranked applicants may receive an EU scholarship covering participation costs plus support for travel, visa and living costs; the exact package is stated by each programme.",
    bangladeshEligibility:
      "Yes. Students worldwide may apply directly to each Erasmus Mundus programme.",
    academicRequirements:
      "A bachelor’s degree, or recognised equivalent, in the subject required by the selected consortium.",
    englishRequirements:
      "Programme-specific. Most computing programmes require a recognised English test unless a stated exemption applies.",
    workExperience: "Programme-specific; generally not mandatory for computing programmes.",
    finalYearStudents:
      "The EU permits applications in the final bachelor year where the programme accepts them and the degree is completed before enrolment.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote: "There is no single Erasmus deadline; each programme publishes its own cycle.",
    officialNoticeUrl:
      "https://erasmus-plus.ec.europa.eu/opportunities/individuals/students/erasmus-mundus-joint-masters",
    applyUrl:
      "https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en",
    lastVerified: VERIFIED_ON,
    baseStatus: "PREPARING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "EU",
  },
  {
    id: "emai",
    name: "EMAI – Erasmus Mundus Joint Master in Artificial Intelligence",
    shortName: "EMAI",
    country: "Spain / Slovenia / Netherlands / Italy",
    universities: "UPF, University of Ljubljana, Radboud University, Sapienza University of Rome",
    programme: "Joint Master in Artificial Intelligence",
    areas: ["AI/ML", "Computer Science", "Data Science"],
    areaLabel: "Artificial Intelligence",
    fundingLevel: "Fully funded",
    fundingCovers:
      "Erasmus Mundus award: participation costs plus €1,400 per month for up to 24 months. A separate tuition-fee-waiver route may also be offered.",
    bangladeshEligibility: "Yes. The scholarship competition is open worldwide.",
    academicRequirements:
      "At least 180 ECTS or equivalent. The transcript must show at least 12 ECTS in mathematics, 12 in programming and 12 in computer science/computer engineering.",
    englishRequirements:
      "IELTS Academic 6.5 overall with at least 6.5 in every component, or an accepted equivalent such as TOEFL iBT 90 with at least 22 per section.",
    workExperience: "Not mandatory; relevant practical or professional experience contributes to ranking.",
    finalYearStudents:
      "Yes. Applicants may sign a statement confirming the bachelor’s degree will be completed before EMAI begins.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote:
      "The 2027 scholarship round is not announced yet. The 2026 scholarship round ran 15 Nov–20 Dec 2025.",
    officialNoticeUrl: "https://www.upf.edu/web/emai/access-admission",
    applyUrl: "https://www.upf.edu/web/emai/access-admission",
    lastVerified: VERIFIED_ON,
    baseStatus: "PREPARING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes: "",
    sourceTag: "EMAI",
  },
  {
    id: "cybersure",
    name: "CYBERSURE – Master’s Programme in Cybersecurity and Assurance",
    shortName: "CYBERSURE",
    country: "Norway + European consortium",
    universities: "NTNU; Aalto; DTU; University of Tartu; EURECOM; KTH; TU Graz",
    programme: "Cybersecurity and Assurance",
    areas: ["Cybersecurity", "Computer Science"],
    areaLabel: "Cybersecurity",
    fundingLevel: "Fully funded",
    fundingCovers:
      "Full and partial Erasmus Mundus scholarships are offered. The full award covers tuition/participation costs, travel support and a monthly allowance stated by the programme.",
    bangladeshEligibility: "Yes. Applications are welcomed worldwide.",
    academicRequirements:
      "Recognised relevant bachelor’s degree equal to at least 180 ECTS / three years, with a strong background in mathematics, CS, computer engineering, IT or a closely related field.",
    englishRequirements:
      "IELTS Academic 6.5 overall and 6.0 in writing, or a listed equivalent. English results may arrive by 18 January 2027.",
    workExperience: "No mandatory work-experience requirement.",
    finalYearStudents:
      "For applicants outside the EU/EEA, final degree documents are required by the 4 January 2027 application deadline. Your October 2026 graduation can fit if final documents are issued on time.",
    intakes: ["2027"],
    opens: "2026-11-16",
    deadline: "2027-01-04",
    dateNote: "Opens 16 Nov 2026 at 09:00 GMT+1; closes 4 Jan 2027 at 23:59 GMT+1.",
    officialNoticeUrl:
      "https://www.cybersure-master.eu/admission/how-to-apply",
    applyUrl: "https://fsweb.no/soknadsweb/login.jsf?inst=ntnu",
    lastVerified: VERIFIED_ON,
    baseStatus: "PREPARING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "CYBERSURE",
  },
  {
    id: "ediss",
    name: "EDISS – Engineering of Data-intensive Intelligent Software Systems",
    shortName: "EDISS",
    country: "Finland / Italy / Spain / Sweden",
    universities: "Åbo Akademi; University of L’Aquila; University of the Balearic Islands; Mälardalen University",
    programme: "Engineering of Data-intensive Intelligent Software Systems",
    areas: ["Software Engineering", "Data Science", "AI/ML", "Computer Science"],
    areaLabel: "Data + Software",
    fundingLevel: "Fully funded",
    fundingCovers:
      "Erasmus Mundus award: €9,000 annual participation cost waived, €1,400 per month for 24 months and health insurance (published total €51,600). EDISS also offers a lower-value fee-waiver/stipend route.",
    bangladeshEligibility: "Yes. Applicants worldwide may compete.",
    academicRequirements:
      "A recognised 180-ECTS-equivalent bachelor’s in computer science, software engineering or a closely related discipline.",
    englishRequirements:
      "IELTS Academic 6.5 with no component below 6.0, TOEFL iBT 93, or another listed equivalent. Bangladesh is not in the automatic exemption group.",
    workExperience: "No mandatory work-experience requirement.",
    finalYearStudents:
      "Yes. Submit an official expected-graduation and remaining-courses statement; final documents are due by the last Friday of July.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote:
      "The 2027 scholarship round is not announced yet. The prior round ran 3 Nov 2025–8 Jan 2026.",
    officialNoticeUrl: "https://www.master-ediss.eu/application-process/",
    applyUrl:
      "https://opintopolku.fi/konfo/en/koulutus/1.2.246.562.13.00000000000000001130",
    lastVerified: VERIFIED_ON,
    baseStatus: "PREPARING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes: "",
    sourceTag: "EDISS",
  },
  {
    id: "deai",
    name: "DEAI – Data Engineering and Artificial Intelligence",
    shortName: "DEAI",
    country: "Belgium / Spain / Austria / Italy / France",
    universities: "ULB; UPC; TU Wien; University of Padua; Université Claude Bernard Lyon 1",
    programme: "Data Engineering and Artificial Intelligence",
    areas: ["Data Engineering", "AI/ML", "Data Science", "Computer Science"],
    areaLabel: "Data Engineering + AI",
    fundingLevel: "Fully funded",
    fundingCovers:
      "Full Erasmus Mundus scholarship: participation costs and insurance plus €1,400 per month for up to 24 months. Partial awards cover full participation costs only.",
    bangladeshEligibility: "Yes. All nationalities may apply.",
    academicRequirements:
      "Recognised bachelor’s of at least 180 ECTS or equivalent; computer science is the preferred background and relevant foundations are assessed.",
    englishRequirements: "Minimum B2; IELTS Academic 5.5 or TOEFL iBT 72 are listed routes.",
    workExperience: "Not required, though relevant experience can contribute to selection.",
    finalYearStudents:
      "Yes. Conditional applications are accepted when the degree will be completed and evidenced before enrolment deadlines.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote:
      "The 2027 scholarship round is not announced yet. The prior scholarship window was 21 Oct 2025–13 Jan 2026.",
    officialNoticeUrl: "https://deai.ulb.be/home/students/admission/",
    applyUrl: "https://deai.ulb.ac.be/emundus/",
    lastVerified: VERIFIED_ON,
    baseStatus: "PREPARING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes: "",
    sourceTag: "DEAI",
  },
  {
    id: "gks-graduate",
    name: "GKS Korea Graduate Scholarship",
    shortName: "GKS Graduate",
    country: "South Korea",
    universities: "Designated GKS universities (embassy or university track)",
    programme: "One year Korean language + two-year Master’s",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity"],
    areaLabel: "CSE / AI / Data",
    fundingLevel: "Fully funded",
    fundingCovers:
      "Round-trip airfare, Korean-language training costs, tuition and study/living allowances; the annual GKS guidelines state the exact benefit amounts.",
    bangladeshEligibility:
      "Yes. Bangladesh had both Embassy Track and University Track allocations in the 2026 graduate call.",
    academicRequirements:
      "A completed bachelor’s for Master’s entry and at least 80% / top 20% or the published GPA equivalent (including 2.64/4.00 in the 2026 framework).",
    englishRequirements:
      "No universal IELTS minimum in the central GKS overview; language evidence and individual university requirements apply. TOPIK can affect the language-year route.",
    workExperience: "No general work-experience requirement.",
    finalYearStudents:
      "Follow the annual Bangladesh notice carefully. The 2026 Embassy notice required final educational certificates and did not accept provisional certificates.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote: "The 2027 Bangladesh call has not been announced yet.",
    officialNoticeUrl:
      "https://www.studyinkorea.go.kr/ko/plan/gksNoticeRead.do?bbsId=BBSMSTR_000000000461&nttId=4420",
    applyUrl:
      "https://www.studyinkorea.go.kr/graduate/plan/scholarship.do?tab=gks-tab1",
    lastVerified: VERIFIED_ON,
    baseStatus: "WATCHING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "NIIED",
  },
  {
    id: "stipendium-hungaricum",
    name: "Stipendium Hungaricum",
    shortName: "Stipendium Hungaricum",
    country: "Hungary",
    universities: "Participating Hungarian universities",
    programme: "Full-degree Master’s; Bangladesh may nominate applicants in any field",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity", "Software Engineering"],
    areaLabel: "CSE / Engineering",
    fundingLevel: "Major funded",
    fundingCovers:
      "Tuition-free study, monthly stipend, dormitory place or accommodation contribution, medical insurance and student services. The call warns that these contributions may not cover every living cost; travel is not a standard benefit.",
    bangladeshEligibility:
      "Yes. Bangladesh’s sending partner permits full-degree Master’s study in any field, subject to national nomination.",
    academicRequirements:
      "A relevant bachelor’s and the admission requirements of the chosen host programme; Bangladesh’s sending-partner process also applies.",
    englishRequirements:
      "Set by the host programme; English-taught CSE programmes commonly request IELTS/TOEFL or accepted proof of instruction.",
    workExperience: "No programme-wide work-experience requirement.",
    finalYearStudents:
      "The annual call may allow missing degree documents to be uploaded later; follow the new call and Bangladesh nomination notice exactly.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote:
      "The 2027/28 cycle is not announced yet. The 2026/27 central deadline was 15 Jan 2026.",
    officialNoticeUrl: "https://stipendiumhungaricum.hu/apply/",
    applyUrl: "https://apply.stipendiumhungaricum.hu/",
    lastVerified: VERIFIED_ON,
    baseStatus: "PREPARING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "Tempus",
  },
  {
    id: "daad-stem",
    name: "DAAD Study Scholarships for STEM Disciplines",
    shortName: "DAAD STEM",
    country: "Germany",
    universities: "Tuition-free state or state-recognised German universities",
    programme: "Full-time on-campus Master’s in mathematics, computer science, natural sciences or engineering",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity", "Software Engineering"],
    areaLabel: "STEM / Computer Science",
    fundingLevel: "Major funded",
    fundingCovers:
      "Monthly payment (€992 in the current call), insurance, travel allowance and €460 annual study allowance, with possible rent/family/disability support. The selected Master’s must itself be tuition-free.",
    bangladeshEligibility:
      "Bangladesh is within the developing/emerging-country target group; confirm the country-specific deadline in the DAAD database.",
    academicRequirements:
      "Above-average performance, a recognised relevant first degree, and normally a most recent degree no more than six years old. The programme must be consecutive and STEM-focused.",
    englishRequirements:
      "Proof in the programme’s language of instruction at least B1 at scholarship application; the university may require a higher IELTS/TOEFL score.",
    workExperience: "Not mandatory; relevant experience is optional evidence.",
    finalYearStudents:
      "The current official call permits a provisional degree document at application if the final certificate is supplied before funding begins.",
    intakes: ["2027"],
    opens: "2026-06-01",
    deadline: null,
    dateNote:
      "The call supports winter 2027/28, but the Bangladesh-specific deadline is not displayed in the accessible official view; no date is guessed.",
    officialNoticeUrl:
      "https://www2.daad.de/deutschland/stipendium/datenbank/en/21148-scholarship-database?detail=57742130",
    applyUrl: "https://www.daad.de/go/en/stipa57742130",
    lastVerified: VERIFIED_ON,
    baseStatus: "WATCHING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "DAAD",
  },
  {
    id: "mext-research",
    name: "MEXT Japan – Research Students Scholarship",
    shortName: "MEXT Japan",
    country: "Japan",
    universities: "Japanese universities through Embassy Recommendation",
    programme: "Research student route leading to a Master’s in the applicant’s prior or related field",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity"],
    areaLabel: "CSE / Research",
    fundingLevel: "Fully funded",
    fundingCovers:
      "Master’s students receive ¥144,000 per month; entrance examination, matriculation and tuition fees are waived, with economy airfare to and from Japan under the published rules.",
    bangladeshEligibility:
      "Yes. Bangladeshi citizens apply through the Ministry of Education / Embassy of Japan process.",
    academicRequirements:
      "Eligibility for a Japanese graduate course (normally a bachelor’s / 16 years of education) in the same or a related field; the 2027 call uses the published age rule and research-plan assessment.",
    englishRequirements:
      "No universal IELTS score in the Embassy Recommendation guidelines. Applicants sit written English and Japanese tests; available language certificates may be submitted.",
    workExperience: "No general work-experience requirement.",
    finalYearStudents:
      "Prospective graduates may apply if they can complete the qualifying degree by the required enrolment date and provide the specified prospective-graduation evidence.",
    intakes: ["2027", "2028"],
    opens: "2026-04-28",
    deadline: "2026-05-12",
    dateNote:
      "The Bangladesh 2027 Embassy Recommendation call opened 28 Apr and closed 12 May 2026 at 5:00 PM. Watch for the 2028 call.",
    officialNoticeUrl:
      "https://shed.gov.bd/pages/moedu-scholarships/%E0%A6%9C%E0%A6%BE%E0%A6%AA%E0%A6%BE%E0%A6%A8-%E0%A6%B8%E0%A6%B0%E0%A6%95%E0%A6%BE%E0%A6%B0%E0%A7%87%E0%A6%B0-ministry-of-education-culture-sports-scienccand-technolory-mext-scholarsh-ip-2027-%E0%A6%8F%E0%A6%B0-%E0%A6%9C%E0%A6%A8%E0%A7%8D%E0%A6%AF-%E0%A6%86%E0%A6%AC%E0%A7%87%E0%A6%A6%E0%A6%A8-%E0%A6%86%E0%A6%B9%E0%A7%8D%E0%A6%AC%E0%A6%BE%E0%A6%A8-dhch2p-69f0b0c1e8be323b8da21193",
    applyUrl: "https://shed.gov.bd/pages/moedu-scholarships",
    lastVerified: VERIFIED_ON,
    baseStatus: "CLOSED",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "MEXT",
  },
  {
    id: "fulbright-bangladesh",
    name: "Fulbright Foreign Student Program – Bangladesh",
    shortName: "Fulbright Bangladesh",
    country: "United States",
    universities: "Accredited U.S. universities through the Fulbright placement process",
    programme: "Graduate study in an eligible field, subject to the Bangladesh country call",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity"],
    areaLabel: "Graduate STEM",
    fundingLevel: "Major funded",
    fundingCovers:
      "The official global programme provides funding support, J-1 sponsorship, an accident/sickness health plan and enrichment activities; the exact Bangladesh grant package must be read in the country call.",
    bangladeshEligibility: "Yes, through the Bangladesh programme when its country call is open.",
    academicRequirements:
      "A bachelor’s degree or equivalent before programme start, plus the academic and field rules stated in the Bangladesh notice.",
    englishRequirements:
      "The global programme recommends at least TOEFL iBT 79–80 or IELTS 6.5; Bangladesh may set a higher country threshold.",
    workExperience:
      "Country-specific. The currently accessible global page does not verify Bangladesh’s 2027/28 experience rule.",
    finalYearStudents:
      "Not confirmed for the Bangladesh 2027/28 cycle; do not rely on general-country assumptions.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote:
      "The current Bangladesh embassy notice is unavailable on the official site, so no deadline is displayed.",
    officialNoticeUrl:
      "https://foreign.fulbrightonline.org/about/foreign-student-program?country=bangladesh",
    applyUrl: "https://apply.iie.org/ffsp2027",
    lastVerified: VERIFIED_ON,
    baseStatus: "WATCHING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "Fulbright",
  },
  {
    id: "bangladesh-ministry",
    name: "Bangladesh Ministry of Education Scholarship Notices",
    shortName: "Bangladesh Ministry Watch",
    country: "Multiple",
    universities: "Varies by bilateral or government notice",
    programme: "Official overseas scholarship notices relevant to Master’s study",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity", "Software Engineering"],
    areaLabel: "CSE / STEM notices",
    fundingLevel: "Programme dependent",
    fundingCovers:
      "Varies by the issuing government or university. Each tracked notice must be checked for tuition, stipend, travel, insurance and nomination terms before it becomes a separate row.",
    bangladeshEligibility:
      "The page is the official Bangladesh government channel for citizens and nominations; each notice has separate eligibility.",
    academicRequirements: "Defined in each official notice and linked call document.",
    englishRequirements: "Defined in each official notice and host programme.",
    workExperience: "Defined in each official notice.",
    finalYearStudents: "Defined in each official notice; never assume eligibility across calls.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote: "Continuous official watchlist; individual notices have their own dates.",
    officialNoticeUrl: "https://shed.gov.bd/pages/moedu-scholarships",
    applyUrl: "https://shed.gov.bd/pages/moedu-scholarships",
    lastVerified: VERIFIED_ON,
    baseStatus: "WATCHING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "SHED",
  },
  {
    id: "chevening",
    name: "Chevening Scholarship – Bangladesh",
    shortName: "Chevening",
    country: "United Kingdom",
    universities: "Eligible UK universities and one-year taught Master’s courses",
    programme: "Any eligible one-year UK Master’s, including computing fields",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity", "Software Engineering"],
    areaLabel: "Any eligible CSE MSc",
    fundingLevel: "Fully funded",
    fundingCovers:
      "University tuition, economy travel, arrival/departure allowances, visa cost and a monthly living allowance under the Chevening terms.",
    bangladeshEligibility: "Yes. Bangladesh has a country scholarship route.",
    academicRequirements:
      "An undergraduate degree enabling entry to a UK postgraduate programme plus three eligible UK course choices.",
    englishRequirements:
      "Chevening has no separate English-test requirement, but every selected university’s admission requirement still applies.",
    workExperience:
      "At least 2,800 hours acquired after completing the undergraduate degree. For the 2027/28 call, applicants who graduated after October 2024 are not eligible.",
    finalYearStudents:
      "No for the 2027/28 call: qualifying work experience must be earned after bachelor completion.",
    intakes: ["2027", "2028"],
    opens: "2026-08-04",
    deadline: "2026-10-06",
    dateNote: "2027/28 applications opened 4 Aug and close 6 Oct 2026 at 11:00 UTC.",
    officialNoticeUrl:
      "https://www.chevening.org/scholarship/bangladesh/",
    applyUrl: "https://asams.chevening.org/apply",
    lastVerified: VERIFIED_ON,
    baseStatus: "OPEN",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "Chevening",
  },
  {
    id: "turkiye-scholarships",
    name: "Türkiye Scholarships – Graduate Programme",
    shortName: "Türkiye Scholarships",
    country: "Türkiye",
    universities: "Participating Turkish universities selected through TBBS",
    programme: "Master’s in natural sciences and engineering, including computing programmes offered in the portal",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity", "Software Engineering"],
    areaLabel: "CSE / Engineering",
    fundingLevel: "Fully funded",
    fundingCovers:
      "University/department placement, full tuition, accommodation, health insurance, one-year Turkish course, a 6,500 TL monthly Master’s stipend and one round-trip flight ticket under the current published scope.",
    bangladeshEligibility: "Yes. Citizens of all countries are eligible.",
    academicRequirements:
      "At least 75% academic achievement for graduate applicants and under age 30 for Master’s applications.",
    englishRequirements:
      "No single scholarship-wide IELTS threshold; applicants must meet the language requirement of programmes offered to them.",
    workExperience: "No general work-experience requirement.",
    finalYearStudents:
      "Yes, if graduating by the end of the current academic year and before August under the published criteria.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote:
      "The official site says the annual period is 10 Jan–20 Feb, but the 2027 call is not yet announced; exact 2027 dates remain blank.",
    officialNoticeUrl: "https://turkiyeburslari.gov.tr/fulltimeprograms",
    applyUrl: "https://tbbs.turkiyeburslari.gov.tr/",
    lastVerified: VERIFIED_ON,
    baseStatus: "PREPARING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes: "",
    sourceTag: "YTB",
  },
  {
    id: "kaist-scholarship",
    name: "KAIST International Graduate Scholarship",
    shortName: "KAIST Scholarship",
    country: "South Korea",
    universities: "Korea Advanced Institute of Science and Technology (KAIST)",
    programme: "MS in Computing, AI, Data Science, Information Security or related engineering fields",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity"],
    areaLabel: "Computing / AI / Security",
    fundingLevel: "Fully funded",
    fundingCovers:
      "KAIST Scholarship: full tuition, national health insurance and a research-linked monthly stipend. Competitive KGPS Master’s awards include full tuition plus KRW 1,000,000 monthly for four regular semesters.",
    bangladeshEligibility:
      "Yes. International applicants who are not Korean citizens may apply and select KAIST Scholarship as their funding source.",
    academicRequirements:
      "A recognised bachelor’s or equivalent by the start of the Master’s. Departmental selection is competitive; no universal minimum CGPA is published on the eligibility page.",
    englishRequirements:
      "IELTS Academic 6.5, TOEFL iBT 83 under the listed scale, TOEIC 720 or TEPS 326, unless a stated waiver applies. Bangladesh is not in the listed waiver groups.",
    workExperience: "No general work-experience requirement.",
    finalYearStudents:
      "Yes. The bachelor’s must be completed by the course start; expected-graduation evidence is used during application.",
    intakes: ["2027"],
    opens: "2026-08-18",
    deadline: "2026-09-01",
    dateNote: "Spring 2027 applications run 18 Aug–1 Sep 2026 (KST); recommendation deadline is 9 Sep.",
    officialNoticeUrl:
      "https://admission.kaist.ac.kr/intl-graduate",
    applyUrl: "https://apply.kaist.ac.kr/GradApply/",
    lastVerified: VERIFIED_ON,
    baseStatus: "PREPARING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "KAIST",
  },
  {
    id: "knight-hennessy",
    name: "Knight-Hennessy Scholars – Stanford",
    shortName: "Knight-Hennessy",
    country: "United States",
    universities: "Stanford University",
    programme: "Any full-time Stanford graduate degree, including eligible CS Master’s programmes",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity", "Software Engineering"],
    areaLabel: "Stanford CS / AI",
    fundingLevel: "Fully funded",
    fundingCovers:
      "Up to three years of tuition and associated fees, living/academic stipend, one annual economy trip, plus a one-time relocation stipend for new scholars.",
    bangladeshEligibility:
      "Yes. There are no nationality, field or regional quotas in the published eligibility rules.",
    academicRequirements:
      "Apply separately and concurrently to an eligible full-time Stanford graduate programme and KHS; first bachelor’s must be January 2020 or later for the 2027 cohort.",
    englishRequirements:
      "KHS has no separate test rule; the selected Stanford graduate programme’s English requirement applies.",
    workExperience: "No mandatory work-experience requirement.",
    finalYearStudents:
      "Yes. Current students are eligible if the first bachelor’s will be earned by September 2027.",
    intakes: ["2027"],
    opens: null,
    deadline: "2026-10-06",
    dateNote: "The 2027 cohort application is open and closes 6 Oct 2026 at 1:00 PM Pacific Time.",
    officialNoticeUrl: "https://knight-hennessy.stanford.edu/admission",
    applyUrl: "https://apply.knight-hennessy.stanford.edu/apply/",
    lastVerified: VERIFIED_ON,
    baseStatus: "OPEN",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes: "",
    sourceTag: "Stanford",
  },
  {
    id: "si-global-professionals",
    name: "Swedish Institute Scholarship for Global Professionals",
    shortName: "SI Global Professionals",
    country: "Sweden",
    universities: "Eligible English-taught Master’s programmes in Sweden",
    programme: "Selected Master’s programmes linked to sustainable development",
    areas: ["Computer Science", "AI/ML", "Data Science", "Cybersecurity", "Software Engineering"],
    areaLabel: "Eligible CSE programmes",
    fundingLevel: "Fully funded",
    fundingCovers:
      "Full tuition paid to the university, SEK 12,000 monthly living allowance, SEK 15,000 one-time travel grant for Bangladesh, and professional/alumni network membership. Insurance is not included by SI.",
    bangladeshEligibility: "Yes. Bangladesh is on the published eligible-country list.",
    academicRequirements:
      "Admission to an SI-eligible Master’s through University Admissions, liability for tuition, and a demonstrated sustainability/leadership contribution.",
    englishRequirements:
      "Set by University Admissions and the selected programme; meet the programme’s English documentation rules.",
    workExperience:
      "Bangladeshi applicants must document at least 3,000 hours of work experience before the stated February cut-off, plus leadership evidence.",
    finalYearStudents:
      "Possible only if the university admission timeline is met, but the separate 3,000-hour work requirement still applies.",
    intakes: ["2027", "2028"],
    opens: null,
    deadline: null,
    dateNote: "The 2027/28 scholarship cycle is not announced yet.",
    officialNoticeUrl:
      "https://si.se/en/apply/scholarships/swedish-institute-scholarships-for-global-professionals/",
    applyUrl: "https://www.universityadmissions.se/intl/start",
    lastVerified: VERIFIED_ON,
    baseStatus: "WATCHING",
    fit: "Pending Review",
    fitReason:
      "Compare the current official criteria with your own profile before assessing fit.",
    nextAction:
      "Check the official notice and update your application plan.",
    notes:
      "",
    sourceTag: "SI",
  },
];

export const scholarshipIds = new Set(scholarships.map((item) => item.id));

export const checklistItems = [
  "Passport",
  "IELTS",
  "CV",
  "SOP/Motivation Letter",
  "Transcript",
  "Provisional/Final Certificate",
  "Recommendation Letter 1",
  "Recommendation Letter 2",
  "Research Proposal",
  "Portfolio/GitHub",
  "Application Submitted",
  "Interview",
  "Result",
] as const;

export type ChecklistItem = (typeof checklistItems)[number];
export type ChecklistState = "Not started" | "In progress" | "Ready" | "Not required";

export const allowedRefreshFields = new Set<keyof Scholarship>([
  "name",
  "shortName",
  "country",
  "universities",
  "programme",
  "areas",
  "areaLabel",
  "fundingLevel",
  "fundingCovers",
  "bangladeshEligibility",
  "academicRequirements",
  "englishRequirements",
  "workExperience",
  "finalYearStudents",
  "intakes",
  "opens",
  "deadline",
  "dateNote",
  "officialNoticeUrl",
  "applyUrl",
  "lastVerified",
  "baseStatus",
  "fit",
  "fitReason",
  "nextAction",
  "notes",
  "sourceTag",
]);
