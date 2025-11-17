/**
 * State-Specific Vertical Configuration
 * Defines which verticals are available for each state
 */

export interface StateVertical {
  state: string;
  verticals: string[];
  priorityVerticals?: string[]; // High-priority verticals for PM visits
}

const DEFAULT_VERTICALS = [
  'Agriculture', 'Health', 'Education', 'Energy', 'Infrastructure',
  'Tourism', 'Manufacturing', 'IT'
];

export const STATE_VERTICALS: StateVertical[] = [
  {
    state: 'Uttar Pradesh',
    verticals: [
      'Agriculture', 'Health', 'Education', 'Energy', 'Infrastructure',
      'Tourism', 'Manufacturing', 'IT', 'Textiles', 'Handicrafts'
    ],
    priorityVerticals: ['Agriculture', 'Health', 'Education', 'Infrastructure']
  },
  {
    state: 'Maharashtra',
    verticals: [
      'Manufacturing', 'IT', 'Tourism', 'Health', 'Education',
      'Energy', 'Infrastructure', 'Agriculture', 'Textiles', 'Automotive'
    ],
    priorityVerticals: ['Manufacturing', 'IT', 'Tourism', 'Infrastructure']
  },
  {
    state: 'Gujarat',
    verticals: [
      'Manufacturing', 'Energy', 'Ports', 'Textiles', 'Chemicals',
      'Agriculture', 'Tourism', 'Infrastructure', 'Automotive', 'Pharmaceuticals'
    ],
    priorityVerticals: ['Manufacturing', 'Energy', 'Ports', 'Chemicals']
  },
  {
    state: 'Tamil Nadu',
    verticals: [
      'Manufacturing', 'Automotive', 'Textiles', 'IT', 'Tourism',
      'Energy', 'Agriculture', 'Education', 'Health', 'Infrastructure'
    ],
    priorityVerticals: ['Manufacturing', 'Automotive', 'Textiles', 'IT']
  },
  {
    state: 'Karnataka',
    verticals: [
      'IT', 'Biotechnology', 'Manufacturing', 'Agriculture', 'Tourism',
      'Education', 'Health', 'Energy', 'Infrastructure', 'Aerospace'
    ],
    priorityVerticals: ['IT', 'Biotechnology', 'Manufacturing', 'Agriculture']
  },
  {
    state: 'Punjab',
    verticals: [
      'Agriculture', 'Food Processing', 'Textiles', 'Manufacturing',
      'Energy', 'Infrastructure', 'Education', 'Health', 'Tourism'
    ],
    priorityVerticals: ['Agriculture', 'Food Processing', 'Textiles', 'Manufacturing']
  },
  {
    state: 'Rajasthan',
    verticals: [
      'Tourism', 'Mining', 'Agriculture', 'Textiles', 'Energy',
      'Infrastructure', 'Manufacturing', 'Education', 'Health', 'Handicrafts'
    ],
    priorityVerticals: ['Tourism', 'Mining', 'Agriculture', 'Textiles']
  },
  {
    state: 'Andhra Pradesh',
    verticals: [
      'Agriculture', 'Fisheries', 'IT', 'Manufacturing', 'Energy',
      'Infrastructure', 'Education', 'Health', 'Tourism', 'Food Processing'
    ],
    priorityVerticals: ['Agriculture', 'Fisheries', 'IT', 'Manufacturing']
  },
  {
    state: 'West Bengal',
    verticals: [
      'Manufacturing', 'Agriculture', 'Fisheries', 'Textiles', 'IT',
      'Tourism', 'Infrastructure', 'Education', 'Health', 'Ports'
    ],
    priorityVerticals: ['Manufacturing', 'Agriculture', 'Fisheries', 'Textiles']
  },
  {
    state: 'Kerala',
    verticals: [
      'Tourism', 'Agriculture', 'Fisheries', 'IT', 'Health',
      'Education', 'Infrastructure', 'Manufacturing', 'Ports', 'Handicrafts'
    ],
    priorityVerticals: ['Tourism', 'Agriculture', 'Fisheries', 'IT']
  }
  ,
  // Generic defaults for remaining states and union territories
  { state: 'Arunachal Pradesh', verticals: DEFAULT_VERTICALS },
  { state: 'Assam', verticals: DEFAULT_VERTICALS },
  { state: 'Bihar', verticals: DEFAULT_VERTICALS },
  { state: 'Chhattisgarh', verticals: DEFAULT_VERTICALS },
  { state: 'Goa', verticals: DEFAULT_VERTICALS },
  { state: 'Haryana', verticals: DEFAULT_VERTICALS },
  { state: 'Himachal Pradesh', verticals: DEFAULT_VERTICALS },
  { state: 'Jharkhand', verticals: DEFAULT_VERTICALS },
  { state: 'Madhya Pradesh', verticals: DEFAULT_VERTICALS },
  { state: 'Manipur', verticals: DEFAULT_VERTICALS },
  { state: 'Meghalaya', verticals: DEFAULT_VERTICALS },
  { state: 'Mizoram', verticals: DEFAULT_VERTICALS },
  { state: 'Nagaland', verticals: DEFAULT_VERTICALS },
  { state: 'Odisha', verticals: DEFAULT_VERTICALS },
  { state: 'Sikkim', verticals: DEFAULT_VERTICALS },
  { state: 'Telangana', verticals: DEFAULT_VERTICALS },
  { state: 'Tripura', verticals: DEFAULT_VERTICALS },
  { state: 'Uttarakhand', verticals: DEFAULT_VERTICALS },
  { state: 'West Bengal', verticals: DEFAULT_VERTICALS },
  { state: 'Andaman and Nicobar Islands', verticals: DEFAULT_VERTICALS },
  { state: 'Chandigarh', verticals: DEFAULT_VERTICALS },
  { state: 'Dadra and Nagar Haveli', verticals: DEFAULT_VERTICALS },
  { state: 'Daman and Diu', verticals: DEFAULT_VERTICALS },
  { state: 'Delhi', verticals: DEFAULT_VERTICALS },
  { state: 'Jammu and Kashmir', verticals: DEFAULT_VERTICALS },
  { state: 'Ladakh', verticals: DEFAULT_VERTICALS },
  { state: 'Lakshadweep', verticals: DEFAULT_VERTICALS },
  { state: 'Puducherry', verticals: DEFAULT_VERTICALS }
];

// Helper functions
export function getVerticalsForState(state: string): string[] {
  const stateConfig = STATE_VERTICALS.find(s => s.state === state);
  return stateConfig?.verticals || [];
}

export function getPriorityVerticalsForState(state: string): string[] {
  const stateConfig = STATE_VERTICALS.find(s => s.state === state);
  return stateConfig?.priorityVerticals || stateConfig?.verticals || DEFAULT_VERTICALS;
}

export function getStatesForVertical(vertical: string): string[] {
  return STATE_VERTICALS
    .filter(state => state.verticals.includes(vertical))
    .map(state => state.state);
}

export function getAllStates(): string[] {
  return STATE_VERTICALS.map(s => s.state);
}

export function getAllVerticals(): string[] {
  const verticals = new Set<string>();
  STATE_VERTICALS.forEach(state => {
    state.verticals.forEach(vertical => verticals.add(vertical));
  });
  return Array.from(verticals).sort();
}

export function validateStateVerticalCombination(state: string, vertical: string): boolean {
  const stateConfig = STATE_VERTICALS.find(s => s.state === state);
  return stateConfig ? stateConfig.verticals.includes(vertical) : false;
}