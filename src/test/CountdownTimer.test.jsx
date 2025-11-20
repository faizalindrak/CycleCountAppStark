import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Extract CountdownTimer component for testing
const CountdownTimer = ({ targetTime }) => {
  const [timeLeft, setTimeLeft] = React.useState(calculateTimeLeft(targetTime));

  function calculateTimeLeft(target) {
    const now = new Date();
    const targetDate = new Date(target);
    const difference = targetDate - now;

    if (difference <= 0) {
      return { expired: true, text: 'Expired' };
    }

    const hours = Math.floor(difference / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    const isWarning = difference < 30 * 60 * 1000; // Less than 30 minutes
    const isCritical = difference < 10 * 60 * 1000; // Less than 10 minutes

    let text = '';
    if (hours > 0) {
      text = `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      text = `${minutes}m ${seconds}s`;
    } else {
      text = `${seconds}s`;
    }

    return { expired: false, text, isWarning, isCritical, difference };
  }

  React.useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetTime));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTime]);

  if (timeLeft.expired) {
    return (
      <span className="text-red-600 font-semibold">
        Session Expired
      </span>
    );
  }

  const colorClass = timeLeft.isCritical
    ? 'text-red-600 font-bold'
    : timeLeft.isWarning
    ? 'text-orange-600 font-semibold'
    : 'text-green-600';

  return (
    <span className={colorClass}>
      Closes in: {timeLeft.text}
    </span>
  );
};

describe('CountdownTimer Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render countdown for future time', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
    render(<CountdownTimer targetTime={futureTime.toISOString()} />);

    expect(screen.getByText(/Closes in:/)).toBeInTheDocument();
    expect(screen.getByText(/2h/)).toBeInTheDocument();
  });

  it('should show "Session Expired" for past time', () => {
    const pastTime = new Date(Date.now() - 1000); // 1 second ago
    render(<CountdownTimer targetTime={pastTime.toISOString()} />);

    expect(screen.getByText('Session Expired')).toBeInTheDocument();
  });

  it('should show green color for time > 30 minutes', () => {
    const futureTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    render(<CountdownTimer targetTime={futureTime.toISOString()} />);

    const element = screen.getByText(/Closes in:/);
    expect(element).toHaveClass('text-green-600');
  });

  it('should show orange color for time between 10-30 minutes (warning)', () => {
    const futureTime = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes
    render(<CountdownTimer targetTime={futureTime.toISOString()} />);

    const element = screen.getByText(/Closes in:/);
    expect(element).toHaveClass('text-orange-600');
  });

  it('should show red color for time < 10 minutes (critical)', () => {
    const futureTime = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    render(<CountdownTimer targetTime={futureTime.toISOString()} />);

    const element = screen.getByText(/Closes in:/);
    expect(element).toHaveClass('text-red-600');
  });

  it('should format time correctly for hours', () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000); // 2h 30m
    render(<CountdownTimer targetTime={futureTime.toISOString()} />);

    expect(screen.getByText(/2h 30m/)).toBeInTheDocument();
  });

  it('should format time correctly for minutes only', () => {
    const futureTime = new Date(Date.now() + 15 * 60 * 1000 + 30 * 1000); // 15m 30s
    render(<CountdownTimer targetTime={futureTime.toISOString()} />);

    expect(screen.getByText(/15m 30s/)).toBeInTheDocument();
  });

  it('should format time correctly for seconds only', () => {
    const futureTime = new Date(Date.now() + 45 * 1000); // 45s
    render(<CountdownTimer targetTime={futureTime.toISOString()} />);

    expect(screen.getByText(/45s/)).toBeInTheDocument();
  });

  it('should update countdown every second', async () => {
    const futureTime = new Date(Date.now() + 61 * 1000); // 61 seconds
    render(<CountdownTimer targetTime={futureTime.toISOString()} />);

    expect(screen.getByText(/1m 1s/)).toBeInTheDocument();

    // Advance time by 2 seconds
    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(screen.getByText(/59s/)).toBeInTheDocument();
    });
  });

  it('should transition from green to orange at 30 minutes', () => {
    const futureTime = new Date(Date.now() + 31 * 60 * 1000); // 31 minutes
    const { rerender } = render(<CountdownTimer targetTime={futureTime.toISOString()} />);

    // Should be green
    let element = screen.getByText(/Closes in:/);
    expect(element).toHaveClass('text-green-600');

    // Update to 29 minutes (less than 30)
    const newTime = new Date(Date.now() + 29 * 60 * 1000);
    rerender(<CountdownTimer targetTime={newTime.toISOString()} />);

    // Should be orange
    element = screen.getByText(/Closes in:/);
    expect(element).toHaveClass('text-orange-600');
  });

  it('should transition from orange to red at 10 minutes', () => {
    const futureTime = new Date(Date.now() + 11 * 60 * 1000); // 11 minutes
    const { rerender } = render(<CountdownTimer targetTime={futureTime.toISOString()} />);

    // Should be orange
    let element = screen.getByText(/Closes in:/);
    expect(element).toHaveClass('text-orange-600');

    // Update to 9 minutes (less than 10)
    const newTime = new Date(Date.now() + 9 * 60 * 1000);
    rerender(<CountdownTimer targetTime={newTime.toISOString()} />);

    // Should be red
    element = screen.getByText(/Closes in:/);
    expect(element).toHaveClass('text-red-600');
  });

  it('should handle countdown reaching zero', async () => {
    const futureTime = new Date(Date.now() + 2000); // 2 seconds
    render(<CountdownTimer targetTime={futureTime.toISOString()} />);

    expect(screen.getByText(/Closes in:/)).toBeInTheDocument();

    // Advance time past the target
    vi.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(screen.getByText('Session Expired')).toBeInTheDocument();
    });
  });
});
