// frontend/src/utils/sections.js
// Single source of truth for the 16 community sections.
// IDs here must match the sectionId strings used in the backend.

export const SECTIONS = [
  { id: 'spiritual-life',       emoji: '☦️',  color: '#7B5EA7', amharic: 'መንፈሳዊ ሕይወት እና ሥነ-ምግባር',      english: 'Spiritual Life & Morality'     },
  { id: 'business-directory',   emoji: '🛒',  color: '#2678b6', amharic: 'የነጋዴዎች መድረክ',                  english: 'Business Directory & B2B'      },
  { id: 'import-export',        emoji: '🚢',  color: '#1a7a4a', amharic: 'አስመጭዎች እና ላኪዎች',               english: 'Import, Export & Trade'        },
  { id: 'education-training',   emoji: '👩‍🏫', color: '#b85c00', amharic: 'ትምህርት እና ስልጠና',               english: 'Education & Training'          },
  { id: 'logistics-supply',     emoji: '🚛',  color: '#5a5a5a', amharic: 'ትራንስፖርት እና አቅርቦት',            english: 'Logistics & Supply'            },
  { id: 'jobs-careers',         emoji: '💼',  color: '#2678b6', amharic: 'የስራ ዕድል እና ቅጥር',              english: 'Jobs & Careers'                },
  { id: 'it-software',          emoji: '💻',  color: '#0f4c81', amharic: 'ቴክኖሎጂ እና ዲጂታላይዜሽን',          english: 'IT & Software Systems'         },
  { id: 'health-wellness',      emoji: '🏥',  color: '#d93025', amharic: 'ጤና እና ደህንነት',                  english: 'Health & Wellness'             },
  { id: 'marketplace-b2c',      emoji: '🤝',  color: '#1a7a4a', amharic: 'የገዢና ሻጭ ትስስር',                english: 'Marketplace / B2C'             },
  { id: 'banking-finance',      emoji: '💵',  color: '#b85c00', amharic: 'ባንክ፣ ፋይናንስ እና ኦዲት',          english: 'Banking & Finance'             },
  { id: 'tenders-bids',         emoji: '📄',  color: '#5a5a5a', amharic: 'ጨረታ እና የሥራ ኮንትራቶች',          english: 'Tenders & Contracts'           },
  { id: 'engineering-arch',     emoji: '📐',  color: '#7B5EA7', amharic: 'ምህንድስና እና ዲዛይን',              english: 'Engineering & Architecture'    },
  { id: 'legal-property',       emoji: '⚖️',  color: '#0f4c81', amharic: 'የሕግ አማካሪዎች ቦርድ',             english: 'Legal & Property Rights'       },
  { id: 'trust-safety',         emoji: '🛡️',  color: '#d93025', amharic: 'የታማኝነት ቁጥጥር',                english: 'Trust & Safety'                },
  { id: 'business-development', emoji: '📈',  color: '#1a7a4a', amharic: 'የንግድ እና የልማት ጥናት',           english: 'Business & Development'        },
  { id: 'healthcare-community', emoji: '🩺',  color: '#d93025', amharic: 'የጤና እና ማህበራዊ አገልግሎት',         english: 'Healthcare & Community'        },
];

/** Get a section by its ID */
export const getSectionById = (id) => SECTIONS.find((s) => s.id === id);

/** Get display name based on i18n language */
export const getSectionName = (section, lang = 'am') =>
  lang === 'am' ? section.amharic : section.english;
