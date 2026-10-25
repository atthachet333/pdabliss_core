import type { ShellMessages } from '../types';

/** English — public shell only. Page bodies remain Thai until the localization episode. */
export const en: ShellMessages = {
  shell: {
    skipToContent: 'Skip to main content',
    home: 'PDA BLISS CORE home',
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
    plannedTag: 'On the roadmap',
    groups: {
      departments: {
        label: 'Departments',
        eyebrow: 'Departments',
        heading: 'Work shaped around each department',
        intro:
          'CORE designs each workspace around a team’s duties and responsibilities, while every department stays connected on one shared set of data.',
        items: {
          executive: {
            label: 'Executive',
            description: 'See the overall picture, issues and key status across the organization',
          },
          sales: { label: 'Sales', description: 'Take orders, track status and manage delivery' },
          operations: {
            label: 'Operations',
            description: 'Plan, track work and hand work over between teams',
          },
          warehouse: {
            label: 'Warehouse',
            description: 'Goods receipt, stock lots, shelf life and stock counts',
          },
          purchasing: {
            label: 'Purchasing',
            description: 'PRs, POs, suppliers and goods-receipt status',
          },
          accounting: {
            label: 'Accounting & Finance',
            description: 'Track payment requests, deposits, balances and documents',
          },
        },
        highlight: {
          eyebrow: 'Department Experience',
          statement:
            'Not every department needs to see the system the same way.\nCORE designs the experience around each user’s role.',
          cta: 'Explore all departments',
        },
      },
      packages: {
        label: 'Packages',
        eyebrow: 'Packages',
        heading: 'Choose the setup that fits your organization',
        intro:
          'From teams just starting to organize their processes to organizations that need more advanced workflow, control and integration.',
        note: 'Priced per company · every branch in one workspace',
        items: {
          starter: { label: 'Starter', description: 'For teams starting to organize their work' },
          business: {
            label: 'Business',
            description: 'For organizations where several departments work together',
          },
          professional: {
            label: 'Professional',
            description: 'For organizations that need more workflow and control',
          },
          enterprise: {
            label: 'Enterprise',
            description: 'For large organizations with specific requirements',
          },
        },
        highlight: {
          eyebrow: 'Consultation',
          statement: 'Not sure which package fits?',
          body: 'Tell us how your organization works, and we’ll help you shape the right setup.',
          cta: 'Request a consultation',
        },
      },
      howItWorks: {
        label: 'How it works',
        eyebrow: 'How CORE works',
        heading: 'From each department’s work\nto one process across the organization',
        intro: 'See how work, data and approvals move between departments, from start to finish.',
        items: {
          how: {
            label: 'How CORE works',
            description: 'The concept and structure behind the system',
          },
          crossDept: {
            label: 'Cross-department work',
            description: 'See how work is handed over between teams',
          },
          workflow: {
            label: 'Workflow & Approval',
            description: 'Define clear steps and owners',
          },
          tracking: {
            label: 'Status tracking',
            description: 'Know where work is and who it is waiting on',
          },
          errorPrevention: {
            label: 'Human Error Prevention',
            description: 'A system designed to help prevent and flag mistakes',
          },
          demo: {
            label: 'Try the CORE demo',
            description: 'Follow one work item through every department — no sign-up',
          },
        },
        highlight: {
          eyebrow: 'Connected Workflow',
          statement: 'Each department works its own way —\nwithout separating the data.',
          cta: 'See how it works',
        },
      },
      solutions: {
        label: 'Solutions',
        eyebrow: 'Solutions',
        heading: 'Start from the problems organizations really face',
        intro:
          'Mistakes, hand-offs and invisible status are where cross-department work usually stalls — and where CORE is designed to help.',
        items: {
          humanError: {
            label: 'Reduce human error',
            description: 'Fewer wrong steps and dropped tasks',
          },
          multiDept: {
            label: 'Connect departments',
            description: 'Less status chasing and duplicate data entry',
          },
          workflow: {
            label: 'Workflow & Approval',
            description: 'Standardize your critical processes',
          },
          stock: {
            label: 'Stock & Expiry Control',
            description: 'Control stock lots and expiry dates',
          },
          visibility: {
            label: 'Operational Visibility',
            description: 'Let team leads see the real status of work',
          },
          management: {
            label: 'Management Control',
            description: 'Key information for decision-making in one place',
          },
        },
        highlight: {
          eyebrow: 'Built around your process',
          statement: 'Every organization’s problems are different.',
          body: 'CORE is designed to start from your real processes — not to force every company into the same way of working.',
          cta: 'Explore by industry',
        },
      },
      enterprise: {
        label: 'Enterprise',
        eyebrow: 'Enterprise',
        heading: 'For organizations that need more than a place to store data',
        intro:
          'Design direction for organizations with many teams, many steps and a need for clear control.',
        note: 'Some capabilities are on the roadmap. Ask our team for the current status.',
        items: {
          scale: {
            label: 'For large organizations',
            description: 'A structure for many teams and complex processes',
          },
          security: {
            label: 'Security & Trust',
            description: 'Access by responsibility, data boundaries and plain statuses',
          },
          audit: { label: 'Audit & Control', description: 'Review history and track changes' },
          customWorkflow: {
            label: 'Custom Workflow',
            description: 'Steps designed around your organization’s structure',
          },
          integration: {
            label: 'API & Integration',
            description: 'Prepared for connecting to external systems',
          },
          support: {
            label: 'Implementation & Support',
            description: 'Setup, training and ongoing support',
          },
        },
        highlight: {
          eyebrow: 'Enterprise',
          statement: 'For organizations that need flexibility,\ncontrol and long-term scalability.',
          cta: 'Talk to the PDA BLISS team',
        },
      },
      about: {
        label: 'About',
        eyebrow: 'About',
        heading: 'The team behind CORE',
        intro:
          'Meet the company that builds PDA BLISS CORE, our thinking, and how we design software around real work.',
        items: {
          company: { label: 'PDA BLISS', description: 'Our company and our approach' },
          why: {
            label: 'Why we built CORE',
            description: 'Where it came from and the problems we want to solve',
          },
          approach: {
            label: 'How we build',
            description: 'How we think about process and user experience',
          },
          consulting: {
            label: 'Consulting',
            description: 'System planning and advice for organizations',
          },
        },
        highlight: {
          eyebrow: 'PDA BLISS COMPANY LIMITED',
          statement:
            'We don’t see software as just screens —\nbut as part of how an organization really works.',
          cta: 'Contact our team',
        },
      },
    },
  },
  footer: {
    byline: 'by PDA BLISS',
    lead: 'Department Operations Platform for organizations',
    description:
      'Workspaces designed for each department, connecting people, work, data and processes in one CORE.',
    shortcuts: 'Quick contact',
    call: 'Call',
    line: 'LINE',
    email: 'Email',
    developedBy: 'Developed by PDA BLISS COMPANY LIMITED',
    groups: { quick: 'Quick links', company: 'Company' },
    industries: 'Industries',
    security: 'Security',
    contactHeading: 'Contact us',
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
    body: 'This website uses essential cookies so PDA BLISS CORE works properly, and only uses cookies for analytics or experience improvements if you allow it.',
    note: 'This website does not currently use analytics or marketing cookies.',
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
