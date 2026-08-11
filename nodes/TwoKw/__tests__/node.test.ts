import { describe, it, expect } from 'vitest';
import { TwoKw } from '../TwoKw.node';

describe('TwoKw node', () => {
  it('declares a node type "2kw" with credential "2kwApi"', () => {
    const instance = new TwoKw();
    expect(instance.description.name).toBe('twoKw');
    expect(instance.description.displayName).toBe('2kw');
    expect(instance.description.credentials).toEqual([{ name: '2kwApi', required: true }]);
  });

  it('exposes a Resource parameter', () => {
    const instance = new TwoKw();
    const resourceField = instance.description.properties.find((p) => p.name === 'resource');
    expect(resourceField).toBeDefined();
    expect(resourceField?.type).toBe('options');
  });
});
