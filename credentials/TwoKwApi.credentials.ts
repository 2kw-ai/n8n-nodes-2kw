import {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class TwoKwApi implements ICredentialType {
  name = '2kwApi';
  displayName = '2kw API';
  documentationUrl = 'https://docs.2kw.ai';

  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.2kw.ai',
      description: 'Base URL of the 2kw.ai API. Override for self-hosted Backbone.',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: { password: true },
      default: '',
      required: true,
      description: 'Personal access token (Bearer). Created in the 2kw.ai dashboard under Settings → API Keys.',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '=Bearer {{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.baseUrl}}',
      url: '/v1/models',
      method: 'GET',
    },
  };
}
