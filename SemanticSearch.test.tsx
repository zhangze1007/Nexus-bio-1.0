import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SemanticSearch from '../components/SemanticSearch';

describe('SemanticSearch Component', () => {
  it('renders search input and button', () => {
    render(<SemanticSearch />);
    expect(screen.getByPlaceholderText(/Search for/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Search/i })).toBeInTheDocument();
  });

  it('performs search and displays results', async () => {
    render(<SemanticSearch />);
    
    const input = screen.getByPlaceholderText(/Search for/i);
    const button = screen.getByRole('button', { name: /Search/i });

    fireEvent.change(input, { target: { value: 'fermentation' } });
    fireEvent.click(button);

    expect(screen.getByText(/Searching.../i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Precision fermentation utilizes/i)).toBeInTheDocument();
    }, { timeout: 1000 });
  });

  it('displays no results message when query not found', async () => {
    render(<SemanticSearch />);
    
    const input = screen.getByPlaceholderText(/Search for/i);
    const button = screen.getByRole('button', { name: /Search/i });

    fireEvent.change(input, { target: { value: 'nonexistentquery123' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/No results found for/i)).toBeInTheDocument();
    }, { timeout: 1000 });
  });
});
