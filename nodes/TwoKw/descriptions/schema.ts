import { INodeProperties } from 'n8n-workflow';

export const schemaOperations: INodeProperties = {
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: { show: { resource: ['schema'] } },
  default: 'get',
  options: [
    {
      name: 'Get',
      value: 'get',
      description: 'Retrieve a schema by ID',
      action: 'Get a schema',
    },
  ],
};

export const schemaFields: INodeProperties[] = [
  {
    displayName: 'Schema',
    name: 'schema',
    type: 'resourceLocator',
    default: { mode: 'list', value: '' },
    required: true,
    displayOptions: { show: { resource: ['schema'], operation: ['get'] } },
    description: 'Pick from a list or paste a schema ID',
    modes: [
      {
        displayName: 'From List',
        name: 'list',
        type: 'list',
        typeOptions: { searchListMethod: 'searchSchemas', searchable: true },
      },
      {
        displayName: 'By ID',
        name: 'id',
        type: 'string',
        placeholder: '78af6e26-30b4-4677-bb3f-a2494444380c',
      },
    ],
  },
];
