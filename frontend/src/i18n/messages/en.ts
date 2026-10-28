import type { ShellMessages } from '../types';

/** English — public shell only. Page bodies remain Thai until the localization episode. */
export const en: ShellMessages = {
  shell: {
    skipToContent: 'Skip to main content',
    home: 'PDA BLISS CORE Department Operations — home',
  },
  header: {
    primaryNav: 'Main navigation',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    menuDialog: 'Menu',
    login: 'Sign in',
    megaRegion: (label) => `${label} menu`,
    explore: 'Learn more',
  },
  language: {
    label: 'Language',
    current: (name) => `Language: ${name}`,
    note: 'The whole website is available in three languages. Product screen previews show the Thai interface of the product.',
  },
  nav: {
    overview: 'Overview',
    contact: 'Contact',
    groups: {
      product: {
        label: 'Product',
        eyebrow: 'Product',
        heading: 'What CORE is\nand how to use it',
        intro:
          'A workspace for each department, connected by one set of data — see how it works, try it, then choose a package.',
        sections: {
          understand: 'Understand CORE',
          start: 'Try and choose',
          byDepartment: 'By department',
        },
        items: {
          how: {
            label: 'How CORE works',
            description: 'How one piece of work moves through departments',
          },
          departments: {
            label: 'Departments',
            description: 'Workspaces shaped around each team’s responsibility',
          },
          demo: {
            label: 'Try CORE',
            description: 'Walk one work item through every department — no sign-up',
          },
          pricing: {
            label: 'Packages',
            description: 'Priced per company; every branch in one workspace',
          },
          executive: { label: 'Executive' },
          sales: { label: 'Sales' },
          operations: { label: 'Operations' },
          warehouse: { label: 'Warehouse' },
          purchasing: { label: 'Purchasing' },
          accounting: { label: 'Accounting & Finance' },
        },
        highlight: {
          eyebrow: 'CORE Demo',
          statement: 'Walk one work item\nthrough every department yourself',
          body: 'Switch roles along the way and see what each department sees.',
          cta: 'Open the CORE demo',
        },
      },
      solutions: {
        label: 'Solutions',
        eyebrow: 'Solutions',
        heading: 'Where CORE fits\nyour business',
        intro:
          'Start from the problems you face, your type of business and the size of your organization.',
        sections: { fit: 'Start from your organization', byIndustry: 'By industry' },
        items: {
          problems: {
            label: 'Problems CORE helps with',
            description: 'Dropped work, human error, approvals and invisible status',
          },
          industries: {
            label: 'Industries',
            description: 'Same principles, different ways of working',
          },
          enterprise: {
            label: 'For organizations',
            description: 'Control, access and implementation as you grow',
          },
          distribution: { label: 'Distribution / Wholesale' },
          services: { label: 'Services' },
          projects: { label: 'Project-based business' },
          retail: { label: 'Retail operations' },
          property: { label: 'Property / operational management' },
          manufacturing: { label: 'Manufacturing' },
        },
        highlight: {
          eyebrow: 'Built around your process',
          statement: 'Every organization’s problems are different.',
          body: 'CORE is designed to start from your real processes — not to force every company into the same way of working.',
          cta: 'Explore by industry',
        },
      },
      resources: {
        label: 'Resources',
        eyebrow: 'Resources',
        heading: 'Understand the system\nbefore you decide to use it',
        intro:
          'Guides to the ideas behind workflow, work control and preparing an organization — useful even if you never use CORE.',
        sections: { start: 'Start here', concepts: 'Core concepts', reference: 'Reference' },
        items: {
          start: {
            label: 'Getting started',
            description: 'What CORE is, what it is not, and where to begin',
          },
          workflow: {
            label: 'Workflow & Operations',
            description: 'How one work item moves through owners, states and handoffs',
          },
          humanError: {
            label: 'Human error',
            description: 'Prevent, detect, alert, control and trace mistakes',
          },
          warehousePrivacy: {
            label: 'Warehouse privacy',
            description: 'Why the warehouse does not see prices, and where that is enforced',
          },
          implementation: { label: 'Implementation guide' },
          security: { label: 'Security & data' },
          glossary: { label: 'CORE glossary' },
        },
        highlight: {
          eyebrow: 'Resource Center',
          statement: 'Seven fully written guides,\nsearchable instantly.',
          body: 'Start from a question, a problem, a department or the stage your organization is at.',
          cta: 'Open the Resource Center',
        },
      },
      about: {
        label: 'About',
        eyebrow: 'About',
        heading: 'The team behind CORE',
        intro:
          'Meet the company that builds PDA BLISS CORE, our thinking, and how we design software around real work.',
        sections: { company: 'PDA BLISS', more: 'How we work' },
        items: {
          company: { label: 'PDA BLISS', description: 'Our company and our approach' },
          why: {
            label: 'Why we built CORE',
            description: 'Where it came from and the problems we want to solve',
          },
          security: {
            label: 'Security & Trust',
            description: 'Who sees what, and what we do not claim yet',
          },
          approach: { label: 'How we build' },
        },
        highlight: {
          eyebrow: 'PDA BLISS COMPANY LIMITED',
          statement:
            'We don’t see software as just screens —\nbut as part of how an organization really works.',
          cta: 'Implementation and consulting',
        },
      },
    },
  },
  footer: {
    lead: 'Department Operations Platform for organizations',
    description:
      'Workspaces designed for each department, connecting people, work, data and processes in one CORE.',
    developedBy: 'Developed by PDA BLISS COMPANY LIMITED',
    groups: { product: 'Product', explore: 'Explore' },
    links: {
      departments: 'Departments',
      howItWorks: 'How it works',
      demo: 'Try CORE',
      pricing: 'Packages',
      solutions: 'Solutions',
      industries: 'Industries',
      enterprise: 'For organizations',
      resources: 'Resource Center',
      about: 'About',
    },
    contactHeading: 'Contact us',
    talk: 'Talk to the PDA BLISS team',
    address: 'Address',
    phone: 'Phone',
    emailLabel: 'Email',
    lineLabel: 'LINE Official Account',
    rightsReserved: 'All rights reserved.',
    legal: 'Legal',
    privacy: 'Privacy Policy',
    terms: 'Terms of Use',
    cookieSettings: 'Cookie settings',
  },
  contact: {
    phoneLabel: 'Khun Win',
    lineLabel: 'LINE OA',
    opensInNewTab: '(opens in a new tab)',
  },
  utility: {
    label: 'Quick tools',
    backToTop: 'Back to top',
    openContact: 'Open contact options',
    closeContact: 'Close contact options',
    panelTitle: 'Contact the PDA BLISS team',
    panelIntro: 'Choose the channel that suits you',
    call: 'Call us',
    line: 'LINE OA',
    email: 'Send an email',
    consult: 'Request a consultation',
    consultDetail: 'Book a conversation with the PDA BLISS team',
  },
  cookie: {
    region: 'Cookie consent',
    title: 'Cookies and your privacy',
    body: 'Our website uses only the cookies it needs to work; any others of ours only with your permission.',
    note: 'This website does not currently use analytics or marketing cookies. The Contact page shows a Google Maps map, a third-party service that may use Google’s own cookies.',
    acceptAll: 'Accept all',
    rejectNonEssential: 'Reject non-essential',
    settings: 'Cookie settings',
    privacyLink: 'Privacy Policy',
    prefsTitle: 'Cookie settings',
    prefsIntro:
      'Choose which cookies you allow. Your choice is saved in this browser only, and you can change it at any time from the website footer.',
    alwaysOn: 'Always on',
    inUse: 'In use',
    notInUse: 'Not currently used on this website',
    save: 'Save settings',
    close: 'Close cookie settings',
    saved: 'Cookie settings saved',
    categories: {
      essential: {
        title: 'Essential cookies',
        subtitle: 'Essential',
        description:
          'Required for the website’s basic functions, such as remembering your cookie choice. They cannot be turned off.',
      },
      analytics: {
        title: 'Analytics cookies',
        subtitle: 'Analytics',
        description: 'Help us understand how visitors use the website so we can improve it.',
      },
      preferences: {
        title: 'Preference cookies',
        subtitle: 'Preferences',
        description: 'Remember your choices to make your next visit easier.',
      },
      marketing: {
        title: 'Marketing cookies',
        subtitle: 'Marketing',
        description: 'Used to show content or advertising relevant to your interests.',
      },
    },
  },
};
