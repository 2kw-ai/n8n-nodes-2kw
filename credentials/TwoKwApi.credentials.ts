import {
  IAuthenticateGeneric,
  Icon,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class TwoKwApi implements ICredentialType {
  name = '2kwApi';
  displayName = '2kw API';
  documentationUrl = 'https://docs.2kw.ai';
  // Deliberately a copy of the node's icon rather than a `../nodes/...` path:
  // n8n resolves `file:` icons relative to the compiled file, and the
  // credential lands in dist/credentials/ while the node icon lands in
  // dist/nodes/TwoKw/ (#363).
  icon: Icon = { light: 'file:icon.light.svg', dark: 'file:icon.dark.svg' };

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
