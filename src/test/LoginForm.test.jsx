import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ signIn: mocks.signIn, signUp: mocks.signUp }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mocks.navigate,
}));

import LoginForm from '../components/LoginForm';

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signIn.mockResolvedValue({ error: null });
    mocks.signUp.mockResolvedValue({ data: { user: null, session: null }, error: null });
  });

  it('renders the branded WMS split layout with Indonesian login controls', () => {
    render(<LoginForm />);

    expect(screen.getAllByText('WMS')).toHaveLength(2);
    expect(screen.getAllByText('Warehouse Management System')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Selamat Datang' })).toBeInTheDocument();
    expect(screen.getByLabelText('Alamat Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Kata Sandi')).toHaveAttribute('type', 'password');
    expect(screen.getByRole('button', { name: 'Masuk Sekarang' })).toBeInTheDocument();
  });

  it('toggles password visibility and submits the login form', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const password = screen.getByLabelText('Kata Sandi');
    await user.type(screen.getByLabelText('Alamat Email'), 'user@example.com');
    await user.type(password, 'secret123');
    await user.click(screen.getByRole('button', { name: 'Tampilkan kata sandi' }));
    expect(password).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Sembunyikan kata sandi' }));
    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Masuk Sekarang' }));

    await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith('user@example.com', 'secret123'));
  });

  it('keeps account creation available from the redesigned login view', async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: 'Buat akun baru' }));
    expect(screen.getByRole('heading', { name: 'Buat Akun' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nama Lengkap')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Daftar Sekarang' })).toBeInTheDocument();
  });
});
