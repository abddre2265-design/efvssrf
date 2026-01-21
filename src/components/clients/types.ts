export type ClientType = 'individual_local' | 'business_local' | 'foreign';
export type ClientStatus = 'active' | 'archived';

export interface Client {
  id: string;
  organization_id: string;
  client_type: ClientType;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  identifier_type: string;
  identifier_value: string;
  country: string;
  governorate: string | null;
  address: string | null;
  postal_code: string | null;
  phone_prefix: string | null;
  phone: string | null;
  whatsapp_prefix: string | null;
  whatsapp: string | null;
  email: string | null;
  status: ClientStatus;
  account_balance: number;
  created_at: string;
  updated_at: string;
}

export interface ClientFormData {
  clientType: ClientType;
  firstName: string;
  lastName: string;
  companyName: string;
  identifierType: string;
  identifierValue: string;
  country: string;
  governorate: string;
  address: string;
  postalCode: string;
  phonePrefix: string;
  phone: string;
  whatsappPrefix: string;
  whatsapp: string;
  email: string;
}

// Identification types per client type
export const IDENTIFIER_TYPES = {
  individual_local: [
    'cin',
    'passport',
    'tax_id'
  ],
  business_local: [
    'tax_id'
  ],
  foreign: [
    'passport',
    'tax_id',
    'ssn',
    'vat_eu',
    'business_number_ca',
    'trade_register',
    'national_id',
    'diplomatic_passport',
    'internal_id'
  ]
} as const;

// Tunisia governorates
export const TUNISIA_GOVERNORATES = [
  'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès', 'Gafsa', 'Jendouba',
  'Kairouan', 'Kasserine', 'Kébili', 'Le Kef', 'Mahdia', 'La Manouba',
  'Médenine', 'Monastir', 'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana',
  'Sousse', 'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'
];

// Country phone prefixes with flags
export const COUNTRY_PHONE_PREFIXES = [
  { code: '+216', country: 'Tunisie', flag: '🇹🇳' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+49', country: 'Allemagne', flag: '🇩🇪' },
  { code: '+39', country: 'Italie', flag: '🇮🇹' },
  { code: '+34', country: 'Espagne', flag: '🇪🇸' },
  { code: '+32', country: 'Belgique', flag: '🇧🇪' },
  { code: '+41', country: 'Suisse', flag: '🇨🇭' },
  { code: '+212', country: 'Maroc', flag: '🇲🇦' },
  { code: '+213', country: 'Algérie', flag: '🇩🇿' },
  { code: '+218', country: 'Libye', flag: '🇱🇾' },
  { code: '+20', country: 'Égypte', flag: '🇪🇬' },
  { code: '+966', country: 'Arabie Saoudite', flag: '🇸🇦' },
  { code: '+971', country: 'Émirats Arabes Unis', flag: '🇦🇪' },
  { code: '+974', country: 'Qatar', flag: '🇶🇦' },
  { code: '+90', country: 'Turquie', flag: '🇹🇷' },
  { code: '+86', country: 'Chine', flag: '🇨🇳' },
  { code: '+81', country: 'Japon', flag: '🇯🇵' },
  { code: '+7', country: 'Russie', flag: '🇷🇺' },
];

// All countries for foreign clients
export const COUNTRIES = [
  'Afghanistan', 'Afrique du Sud', 'Albanie', 'Algérie', 'Allemagne', 'Andorre',
  'Angola', 'Arabie Saoudite', 'Argentine', 'Arménie', 'Australie', 'Autriche',
  'Azerbaïdjan', 'Bahreïn', 'Bangladesh', 'Belgique', 'Bénin', 'Biélorussie',
  'Bolivie', 'Bosnie-Herzégovine', 'Botswana', 'Brésil', 'Bulgarie', 'Burkina Faso',
  'Burundi', 'Cambodge', 'Cameroun', 'Canada', 'Cap-Vert', 'Centrafrique',
  'Chili', 'Chine', 'Chypre', 'Colombie', 'Comores', 'Congo', 'Corée du Nord',
  'Corée du Sud', 'Costa Rica', 'Côte d\'Ivoire', 'Croatie', 'Cuba', 'Danemark',
  'Djibouti', 'Dominique', 'Égypte', 'Émirats Arabes Unis', 'Équateur', 'Érythrée',
  'Espagne', 'Estonie', 'États-Unis', 'Éthiopie', 'Finlande', 'France', 'Gabon',
  'Gambie', 'Géorgie', 'Ghana', 'Grèce', 'Guatemala', 'Guinée', 'Guinée-Bissau',
  'Haïti', 'Honduras', 'Hongrie', 'Inde', 'Indonésie', 'Irak', 'Iran', 'Irlande',
  'Islande', 'Israël', 'Italie', 'Jamaïque', 'Japon', 'Jordanie', 'Kazakhstan',
  'Kenya', 'Kirghizistan', 'Koweït', 'Laos', 'Lesotho', 'Lettonie', 'Liban',
  'Libéria', 'Libye', 'Liechtenstein', 'Lituanie', 'Luxembourg', 'Macédoine du Nord',
  'Madagascar', 'Malaisie', 'Malawi', 'Maldives', 'Mali', 'Malte', 'Maroc',
  'Maurice', 'Mauritanie', 'Mexique', 'Moldavie', 'Monaco', 'Mongolie', 'Monténégro',
  'Mozambique', 'Myanmar', 'Namibie', 'Népal', 'Nicaragua', 'Niger', 'Nigeria',
  'Norvège', 'Nouvelle-Zélande', 'Oman', 'Ouganda', 'Ouzbékistan', 'Pakistan',
  'Palestine', 'Panama', 'Paraguay', 'Pays-Bas', 'Pérou', 'Philippines', 'Pologne',
  'Portugal', 'Qatar', 'République Dominicaine', 'République Tchèque', 'Roumanie',
  'Royaume-Uni', 'Russie', 'Rwanda', 'Salvador', 'Sénégal', 'Serbie', 'Singapour',
  'Slovaquie', 'Slovénie', 'Somalie', 'Soudan', 'Sri Lanka', 'Suède', 'Suisse',
  'Syrie', 'Tadjikistan', 'Tanzanie', 'Tchad', 'Thaïlande', 'Togo', 'Trinité-et-Tobago',
  'Tunisie', 'Turkménistan', 'Turquie', 'Ukraine', 'Uruguay', 'Venezuela', 'Vietnam',
  'Yémen', 'Zambie', 'Zimbabwe'
];

// Validation functions
export const validateCIN = (value: string): boolean => {
  return /^\d{8}$/.test(value);
};

export const validateTaxId = (value: string): boolean => {
  // Formats: NNNNNNN/X, NNNNNN/X, NNNNNNNX/X/X/NNN, NNNNNNX/X/X/NNN
  return /^(\d{6,7}\/[A-Z]|\d{6,7}[A-Z]\/[A-Z]\/[A-Z]\/\d{3})$/.test(value);
};

export const getIdentifierValidation = (identifierType: string, value: string): { valid: boolean; message?: string } => {
  if (!value) return { valid: false, message: 'required' };
  
  switch (identifierType) {
    case 'cin':
      if (!validateCIN(value)) {
        return { valid: false, message: 'cin_invalid' };
      }
      break;
    case 'tax_id':
      if (!validateTaxId(value)) {
        return { valid: false, message: 'tax_id_invalid' };
      }
      break;
  }
  
  return { valid: true };
};
