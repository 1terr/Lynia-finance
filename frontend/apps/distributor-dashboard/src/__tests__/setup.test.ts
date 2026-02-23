describe('Jest Setup Verification', () => {
  it('runs basic assertions', () => {
    expect(true).toBe(true);
    expect(1 + 1).toBe(2);
  });

  it('has jest-dom matchers', () => {
    const element = document.createElement('div');
    element.textContent = 'Hello Test';
    document.body.appendChild(element);
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('Hello Test');
    document.body.removeChild(element);
  });

  it('handles TypeScript types', () => {
    const obj: { name: string; age: number } = { name: 'Test', age: 25 };
    expect(obj.name).toBe('Test');
    expect(obj.age).toBe(25);
  });

  it('mocks modules', () => {
    const mockFn = jest.fn();
    mockFn('test');
    expect(mockFn).toHaveBeenCalledWith('test');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });
});
