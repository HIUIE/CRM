import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrderCreateDrawer } from '../OrderCreateDrawer';
import * as ApiLib from '../../../lib/api';
import '@testing-library/jest-dom';

// Mock the API library
vi.mock('../../../lib/api', () => ({
  apiFetch: vi.fn(),
  getErrorMessage: vi.fn((err, fallback) => fallback),
}));

// Mock the Drawer component to just render its children and footer
vi.mock('../Drawer', () => ({
  Drawer: ({ children, footer, isOpen }: any) => isOpen ? (
    <div data-testid="mock-drawer">
      {children}
      <div data-testid="mock-drawer-footer">{footer}</div>
    </div>
  ) : null,
}));

// Mock the Combobox component to bypass complex DOM interactions for this test
vi.mock('../Combobox', () => ({
  Combobox: ({ value, onChange, placeholder }: any) => (
    <input 
      data-testid="mock-combobox" 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      placeholder={placeholder} 
    />
  ),
}));

// Mock lucid icons to prevent SVG rendering issues in JSDOM
vi.mock('lucide-react', () => ({
  Hash: () => <div data-testid="icon-hash" />,
}));

describe('OrderCreateDrawer Form Validation', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();
  const mockApiFetch = vi.mocked(ApiLib.apiFetch);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <OrderCreateDrawer 
          isOpen={true} 
          onClose={mockOnClose} 
          onSuccess={mockOnSuccess} 
          {...props} 
        />
      </MemoryRouter>
    );
  };

  it('initializes form fields by fetching next display ID', async () => {
    mockApiFetch.mockResolvedValueOnce({ nextId: 'ORD-NEXT-001' });

    renderComponent();

    // Verify apiFetch was called to get next display id
    expect(mockApiFetch).toHaveBeenCalledWith('/api/orders/next-display-id');

    // Wait for the async effect to update the input
    await waitFor(() => {
      const displayIdInput = screen.getAllByRole('textbox')[0] as HTMLInputElement;
      expect(displayIdInput.value).toBe('ORD-NEXT-001');
    });
  });

  it('displays API validation error messages correctly', async () => {
    // Setup initial ID fetch success
    mockApiFetch.mockResolvedValueOnce({ nextId: 'ORD-NEXT-001' });
    
    // Setup form submit to fail
    const apiError = new Error('Invalid input');
    mockApiFetch.mockRejectedValueOnce(apiError);
    vi.mocked(ApiLib.getErrorMessage).mockReturnValue('订单总额必须大于 0');

    renderComponent();

    // Wait for the initial load
    await waitFor(() => {
      expect(screen.getAllByRole('textbox')[0]).toHaveValue('ORD-NEXT-001');
    });

    // Fill form minimum requirements
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(screen.getByTestId('mock-combobox'), { target: { value: '1' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '-500' } }); // Invalid amount
    fireEvent.change(inputs[2], { target: { value: 'Some Product' } }); // product summary

    // Submit the form
    const submitBtn = screen.getByText('确认并进入详情');
    fireEvent.click(submitBtn);

    // Verify saving state (button text changes)
    expect(submitBtn).toHaveTextContent('正在同步...');

    // Wait for error to appear
    await waitFor(() => {
      expect(screen.getByText('订单总额必须大于 0')).toBeInTheDocument();
    });

    // Ensure onSuccess was NOT called
    expect(mockOnSuccess).not.toHaveBeenCalled();
  });

  it('submits form data and calls onSuccess when validation passes', async () => {
    // Setup initial ID fetch success
    mockApiFetch.mockResolvedValueOnce({ nextId: 'ORD-NEXT-002' });
    
    // Setup form submit to succeed
    mockApiFetch.mockResolvedValueOnce({ display_id: 'ORD-NEXT-002' });

    renderComponent();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getAllByRole('textbox')[0]).toHaveValue('ORD-NEXT-002');
    });

    // Fill the form
    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(screen.getByTestId('mock-combobox'), { target: { value: '42' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '9999.99' } });
    fireEvent.change(inputs[2], { target: { value: 'Valid Product Summary' } });

    // Submit
    const submitBtn = screen.getByText('确认并进入详情');
    fireEvent.click(submitBtn);

    // Wait for onSuccess to be called
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith('ORD-NEXT-002');
    });

    // Verify what payload was sent
    expect(mockApiFetch).toHaveBeenCalledTimes(2); // 1. nextId, 2. POST orders
    const postCall = mockApiFetch.mock.calls[1];
    expect(postCall[0]).toBe('/api/orders');
    expect(postCall[1]?.method).toBe('POST');
    
    // Verify payload type conversions (totalAmount and customerId should be numbers)
    const payload = JSON.parse(postCall[1]?.body as string);
    expect(payload.customerId).toBe(42);
    expect(payload.totalAmount).toBe(9999.99);
    expect(payload.productSummary).toBe('Valid Product Summary');
    
    // Verify drawer closed
    expect(mockOnClose).toHaveBeenCalled();
  });
});
