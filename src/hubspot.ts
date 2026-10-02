import { Client, ApiError } from '@hubspot/api-client';

function getHubSpotApiKey(): string {
  const key = process.env.HUBSPOT_API_KEY;
  if (!key) {
    throw new Error('HubSpot API key is missing from environment (HUBSPOT_API_KEY).');
  }
  return key;
}

const client = new Client({ apiKey: getHubSpotApiKey() });

export async function fetchStageOneLeads(): Promise<Object[]> {
  try {
    const response = await client.crm.contacts.getPage({
      limit: 100,
      properties: ['firstname', 'lastname', 'email', 'leadstatus', 'lifecyclestage'],
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'lifecyclestage',
              operator: 'EQ',
              value: 'stage1',
            },
          ],
        },
      ],
    });
    return response.body.results;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('HubSpot API error while fetching leads:', error.body);
    }
    throw error;
  }
}

export async function fetchStageOneDeals(): Promise<Object[]> {
  try {
    const response = await client.crm.deals.getPage({
      limit: 100,
      properties: ['dealname', 'amount', 'dealstage', 'pipeline'],
      filterGroups: [
        {
          filters: [
            {
              propertyName: 'dealstage',
              operator: 'EQ',
              value: 'stage1',
            },
          ],
        },
      ],
    });
    return response.body.results;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('HubSpot API error while fetching deals:', error.body);
    }
    throw error;
  }
}

export default {
  fetchStageOneLeads,
  fetchStageOneDeals,
};