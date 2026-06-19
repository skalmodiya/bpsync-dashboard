export interface Prompt {
  id: string;
  label: string;
  content: string;
  category?: string;
}

export const GLOBAL_PROMPTS: Prompt[] = [
  {
    id: 'g1',
    label: 'Sync status summary',
    content: 'Summarize the current BUPA sync status. Highlight total employees, how many are synced, failed, and pending.',
  },
  {
    id: 'g2',
    label: 'Explain error categories',
    content: 'Explain the different error categories that appear in the BUPA sync log and what each one means.',
  },
  {
    id: 'g3',
    label: 'Recommended next steps',
    content: 'Based on the current sync errors and status, what are the recommended next steps to resolve issues?',
  },
  {
    id: 'g4',
    label: 'What is BUPA sync?',
    content: 'Explain what the BUPA Business Partner sync process does, why it matters, and how it works.',
  },
  {
    id: 'g5',
    label: 'How to retry failed records',
    content: 'How do I retry failed sync records? What are the different retry modes available?',
  },
  {
    id: 'g6',
    label: 'Agent fix proposals',
    content: 'Explain how the AI agent fix proposal feature works and when I should use it.',
  },
  {
    id: 'g7',
    label: 'S/4HANA connection',
    content: 'How is the app connected to S/4HANA? What data does it read and write?',
  },
];

export const PAGE_PROMPTS: Record<string, Prompt[]> = {
  '/': [
    {
      id: 'dash1',
      label: 'Why are there failures?',
      content: 'Looking at the dashboard, why might there be sync failures? What are the most common root causes?',
    },
    {
      id: 'dash2',
      label: 'Interpret these numbers',
      content: 'Help me interpret the sync overview numbers. What does a healthy sync look like vs an unhealthy one?',
    },
    {
      id: 'dash3',
      label: 'Error breakdown explained',
      content: 'Explain the error breakdown chart. What do the different error categories indicate about the data quality?',
    },
  ],
  '/records': [
    {
      id: 'rec1',
      label: 'Explain this error type',
      content: 'Explain the most common error types shown in the records page and how to fix each one.',
    },
    {
      id: 'rec2',
      label: 'Filter strategy',
      content: 'What is the best strategy to filter and prioritize which failed records to fix first?',
    },
    {
      id: 'rec3',
      label: 'Bulk retry guidance',
      content: 'When should I use bulk retry vs individual retry? What are the risks of each?',
    },
  ],
  '/workflows': [
    {
      id: 'wf1',
      label: 'Workflow status explained',
      content: 'Explain the current workflow execution statuses. What do success, error, and running mean?',
    },
    {
      id: 'wf2',
      label: 'When to trigger manually',
      content: 'When should I manually trigger a sync workflow vs letting it run on schedule?',
    },
    {
      id: 'wf3',
      label: 'Orchestration vs Local',
      content: 'What is the difference between the Orchestration workflow and the Local Services workflow?',
    },
  ],
  '/agent': [
    {
      id: 'agt1',
      label: 'What can you help with?',
      content: 'What are all the things you can help me with in the context of BUPA sync and S/4HANA?',
    },
    {
      id: 'agt2',
      label: 'Analyze errors for me',
      content: 'Analyze the current BUPA sync errors and provide specific fix recommendations for each error type.',
    },
    {
      id: 'agt3',
      label: 'Confidence score meaning',
      content: 'Explain what the confidence scores in the agent fix proposals mean and how to act on them.',
    },
  ],
  '/settings': [
    {
      id: 'set1',
      label: 'Help configure n8n',
      content: 'Help me configure the n8n connection. What settings are required and where do I find them?',
    },
    {
      id: 'set2',
      label: 'AI Core setup guide',
      content: 'Walk me through setting up SAP AI Core with the BTP destination for the agent.',
    },
    {
      id: 'set3',
      label: 'S/4HANA vs Mock',
      content: 'When should I use the real S/4HANA source vs the Mock server? What are the differences?',
    },
  ],
  '/audit': [
    {
      id: 'aud1',
      label: 'Interpret audit events',
      content: 'Explain the different audit event types and what they tell me about system activity.',
    },
    {
      id: 'aud2',
      label: 'Suspicious activity?',
      content: 'Are there any patterns in the audit log that might indicate configuration issues or unexpected behavior?',
    },
  ],
  '/methodology': [
    {
      id: 'meth1',
      label: 'Sync methodology overview',
      content: 'Give me a high-level overview of the BUPA sync methodology and each phase.',
    },
  ],
  '/api-reference': [
    {
      id: 'api1',
      label: 'Which endpoint to use?',
      content: 'I need to integrate with the BPSYNC backend. Which API endpoint should I use for my use case?',
    },
    {
      id: 'api2',
      label: 'Explain S/4HANA endpoints',
      content: 'Explain the S/4HANA endpoints the app uses and what data they return.',
    },
  ],
};

export const USER_PROMPTS_KEY = 'bpsync_copilot_user_prompts';
