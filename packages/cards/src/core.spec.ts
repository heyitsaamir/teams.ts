import { AdaptiveCard, TextBlock } from './core';

describe('AdaptiveCard', () => {
  it('should default version to 1.5', () => {
    const card = new AdaptiveCard(new TextBlock('Hello'));
    expect(card.version).toEqual('1.5');
  });

  it('should include version in serialized JSON', () => {
    const card = new AdaptiveCard(new TextBlock('Hello'));
    const json = JSON.stringify(card);
    const parsed = JSON.parse(json);
    expect(parsed.version).toEqual('1.5');
  });

  it('should allow overriding version', () => {
    const card = new AdaptiveCard(new TextBlock('Hello')).withVersion('1.4');
    expect(card.version).toEqual('1.4');
  });
});
