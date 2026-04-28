import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Chip from '../Chip';

describe('Chip', () => {
  it('renders children text', () => {
    render(<Chip>测试标签</Chip>);
    expect(screen.getByText('测试标签')).toBeDefined();
  });

  it('applies default neutral tone', () => {
    const { container } = render(<Chip>默认</Chip>);
    expect((container.firstChild as HTMLElement).className).toContain('chip-neutral');
  });

  it('applies success tone class', () => {
    const { container } = render(<Chip tone="success">成功</Chip>);
    expect((container.firstChild as HTMLElement).className).toContain('chip-success');
  });
});
